-- Online and hybrid events.
-- Imported events: read from the event text ("tiešsaistes lekcija", "notiks tiešsaistē",
-- Zoom, Teams, "vienlaikus tiešsaistē"); mentions of buying tickets or signing up online
-- do not count. Organizer events: the organizer says how it takes place and may give a
-- call link. The place stays as given; only the way of taking part changes.

-- 1. Read from text: 'online', 'hybrid' or null.
create or replace function meets_private.online_from_text(p_text text)
 returns text language sql immutable set search_path to ''
as $$
 with c as (select regexp_replace(regexp_replace(coalesce(p_text,''),'\s+',' ','g'),
   '((piesak|pieteik|reģistr|iegād|nopirk|pērk|biļet|aizpild|anket|maksā)\w*[^.]{0,40}(tiešsaistē|online))|((tiešsaistē|online)[^.]{0,20}(piesak|pieteik|reģistr|biļet|veikal))','','gi') t)
 select case
  when t ~* '(klātien\w*[^.]{0,80}(tiešsaist|online|zoom|teams|tiešraid)|(tiešsaist|online|zoom|teams)[^.]{0,80}klātien|vienlaikus tiešsaist|tiešraid)' then 'hybrid'
  when t ~* '(tiešsaistes (lekcij|seminār|nodarb|tikšan|sapulc|konsult|kurs|pasākum|sarun|diskusij|sanāksm|lasījum|vebinār|vingroš|meistarklas|darbnīc)|(lekcij|seminār|nodarb|vingroš|tikšan|sapulc|konsult|kurs|sarun|diskusij|sanāksm|lasījum|meistarklas|darbnīc)\w*\s+tiešsaistē|(notiks|norisināsies|norisinās|būs|noritēs) tiešsaistē|tiešsaistē (notiks|norisināsies)|zoom|ms teams|microsoft teams|google meet|vebinār|webinar|\monline\M)' then 'online'
 end from c
$$;

-- 2. Columns: the call link on events and submissions, and how a submission takes place.
alter table public.events add column if not exists online_url text;
alter table public.events drop constraint if exists events_online_url_https;
alter table public.events add constraint events_online_url_https check (online_url is null or online_url ~ '^https://');
alter table public.meets_submissions add column if not exists attendance_mode text not null default 'in_person';
alter table public.meets_submissions drop constraint if exists meets_submissions_attendance_mode_check;
alter table public.meets_submissions add constraint meets_submissions_attendance_mode_check check (attendance_mode in ('in_person','online','hybrid'));
alter table public.meets_submissions add column if not exists online_url text;
alter table public.meets_submissions drop constraint if exists meets_submissions_online_url_https;
alter table public.meets_submissions add constraint meets_submissions_online_url_https check (online_url is null or online_url ~ '^https://');

-- 3. Apply to an imported event that is still marked as in person (people's choices stay).
create or replace function meets_private.apply_found_online(p_event uuid, p_mode text)
 returns boolean language sql set search_path to ''
as $$
 with u as (
  update public.events e set attendance_mode=p_mode, updated_at=now()
  where e.id=p_event and p_mode in ('online','hybrid')
    and coalesce(e.attendance_mode,'unknown') in ('in_person','unknown')
    and coalesce(e.import_key,'') not like 'meets-user:%'
  returning 1)
 select exists(select 1 from u)
$$;

-- 4. One-off: titles and descriptions of coming events.
select meets_private.apply_found_online(e.id, meets_private.online_from_text(coalesce(e.title,'')||'. '||coalesce(e.description,'')))
from public.events e
where coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date
  and coalesce(e.attendance_mode,'unknown') in ('in_person','unknown');

-- 5. The page job also looks for online events; pages read before are read once more.
alter table meets_private.price_checks add column if not exists online_checked boolean not null default false;

create or replace function meets_private.price_check_tick(p_batch integer default 10)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare r record; main text; found jsonb; n_done int := 0; n_found int := 0; n_new int := 0; n_online int := 0;
begin
 if not pg_try_advisory_xact_lock(201026,1301) then return jsonb_build_object('state','busy'); end if;
 for r in
  select c.event_id, c.request_id, h.status_code, h.content
  from meets_private.price_checks c
  left join net._http_response h on h.id = c.request_id
  where c.status='queued' and (h.id is not null or c.queued_at < now()-interval '30 minutes')
  limit 50
 loop
  if r.status_code is distinct from 200 or r.content is null then
   update meets_private.price_checks set status='failed',checked_at=now() where event_id=r.event_id;
   continue;
  end if;
  -- Only the event's own text: after the calendar links, before "Saistītas tēmas".
  main := replace(replace(replace(regexp_replace(regexp_replace(r.content,'<[^>]+>',' ','g'),'\s+',' ','g'),'&nbsp;',' '),'&euro;','€'),'&quot;','"');
  main := coalesce(substring(main from 'Yahoo! Calendar(.*?)(?:Saistītas tēmas|Drukāt lapu)'),'');
  found := meets_private.price_from_text(main);
  if meets_private.apply_found_price(r.event_id, found) then n_found := n_found + 1; end if;
  if meets_private.apply_found_online(r.event_id, meets_private.online_from_text(main)) then n_online := n_online + 1; end if;
  update meets_private.price_checks set status=case when found is null then 'none' else 'found' end,
   checked_at=now(), result=found, online_checked=true where event_id=r.event_id;
  n_done := n_done + 1;
 end loop;
 -- Next pages: upcoming events with an unknown price, not checked in the last week.
 for r in
  select distinct on (e.id) e.id, regexp_replace(es.source_url,'\?date=\d+$','') url
  from public.events e
  join public.event_sources es on es.event_id = e.id
  left join meets_private.price_checks c on c.event_id = e.id
  where (coalesce(e.price_status,'unknown')='unknown' or c.online_checked is not true)
    and e.status in ('published','pending_review')
    and coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date
    and es.source_url ~ '^https://[^/]+/lv/notikums/'
    and (c.event_id is null
      or (c.status<>'queued' and c.checked_at < now()-interval '7 days')
      or (c.status<>'queued' and c.online_checked is not true))
  order by e.id, es.id
  limit greatest(1,least(coalesce(p_batch,10),30))
 loop
  insert into meets_private.price_checks(event_id,source_url,request_id,status,queued_at)
  values(r.id,r.url,net.http_get(url:=r.url,timeout_milliseconds:=20000),'queued',now())
  on conflict (event_id) do update set source_url=excluded.source_url,request_id=excluded.request_id,
   status='queued',queued_at=now(),checked_at=null;
  n_new := n_new + 1;
 end loop;
 return jsonb_build_object('checked',n_done,'found',n_found,'online',n_online,'asked',n_new);
end;
$$;
