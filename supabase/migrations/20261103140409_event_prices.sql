-- Event prices from the event text. Almost every imported event has price_status
-- 'unknown'. Municipal event pages (…/lv/notikums/…) often state the price in the
-- text ("Ieeja 5 eiro", "Biļetes 15, 20 EUR", "Ieeja bez maksas"), and so do some
-- descriptions. A small job reads those pages a few at a time and fills in the
-- price only where it is still unknown, so prices set by people are never changed.

-- 1. Read a price from plain text: status, lowest and highest amount, and the sentence.
create or replace function meets_private.price_from_text(p_text text)
 returns jsonb language plpgsql immutable set search_path to ''
as $$
declare
 t text := coalesce(p_text,'');
 paid boolean; free boolean; status text; amounts numeric[]; m text[]; v numeric; snip text;
begin
 -- "Biļetes nav nepieciešamas" says nothing about paying.
 paid := regexp_replace(t,'(biļetes nav[^.]*|bez biļet\w*)','','gi') ~* '(biļet|ieejas maksa|dalības maksa|\d\s*(€|eur\M|eiro)|€\s*\d)';
 free := t ~* '(bez maksas|bezmaksas|ieeja brīva|brīva ieeja)';
 if not paid and not free then return null; end if;
 status := case when paid and free then 'mixed' when paid then 'paid' else 'free' end;
 -- Amounts next to a currency: "5 eiro", "3,50 EUR", "15, 20, 25 EUR", "€10".
 amounts := array[]::numeric[];
 for m in select regexp_matches(t,'((?:\d+(?:[.,]\d{1,2})?\s*(?:,|–|-|/|un|līdz)\s*)*\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\M|eiro)','gi') loop
  for v in select replace(x[1],',','.')::numeric from regexp_matches(m[1],'(\d+(?:[.,]\d{1,2})?)','g') x loop
   if v>0 and v<=500 then amounts := amounts||v; end if;
  end loop;
 end loop;
 for m in select regexp_matches(t,'€\s*(\d+(?:[.,]\d{1,2})?)','g') loop
  v := replace(m[1],',','.')::numeric; if v>0 and v<=500 then amounts := amounts||v; end if;
 end loop;
 snip := btrim(substring(t from '(?i)([^.!?]{0,60}(?:biļet|ieejas maksa|dalības maksa|\d\s*(?:€|eur\M|eiro)|€\s*\d|bez maksas|bezmaksas|ieeja brīva|brīva ieeja)[^!?]{0,50})'));
 return jsonb_build_object('status',status,
  'min',(select min(a) from unnest(amounts) a),'max',(select max(a) from unnest(amounts) a),
  'text',left(snip,140));
end;
$$;

-- 2. Apply a found price to an event whose price is still unknown.
create or replace function meets_private.apply_found_price(p_event uuid, p_found jsonb)
 returns boolean language sql set search_path to ''
as $$
 with u as (
  update public.events e set
   price_status = p_found->>'status',
   price_min = (p_found->>'min')::numeric,
   price_max = case when (p_found->>'max')::numeric > (p_found->>'min')::numeric then (p_found->>'max')::numeric end,
   price_text = coalesce(nullif(p_found->>'text',''),e.price_text),
   currency = case when p_found->>'min' is not null then 'EUR' else e.currency end,
   updated_at = now()
  where e.id = p_event and coalesce(e.price_status,'unknown') = 'unknown'
    and p_found is not null and p_found->>'status' in ('free','paid','mixed')
  returning 1)
 select exists(select 1 from u)
$$;

-- 3. One-off: events whose own description already states the price (e.g. Sigulda).
select meets_private.apply_found_price(e.id, meets_private.price_from_text(e.description))
from public.events e
where coalesce(e.price_status,'unknown')='unknown' and coalesce(e.description,'')<>''
  and coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date;

-- 4. Page checks: one row per event, re-checked weekly while the price stays unknown.
create table if not exists meets_private.price_checks(
 event_id uuid primary key references public.events(id) on delete cascade,
 source_url text not null,
 request_id bigint,
 status text not null default 'queued' check (status in ('queued','found','none','failed')),
 queued_at timestamptz not null default now(),
 checked_at timestamptz,
 result jsonb
);
alter table meets_private.price_checks enable row level security;

-- 5. The job: collect answered pages, then ask for the next few.
create or replace function meets_private.price_check_tick(p_batch integer default 10)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare r record; main text; found jsonb; n_done int := 0; n_found int := 0; n_new int := 0;
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
  update meets_private.price_checks set status=case when found is null then 'none' else 'found' end,
   checked_at=now(), result=found where event_id=r.event_id;
  n_done := n_done + 1;
 end loop;
 -- Next pages: upcoming events with an unknown price, not checked in the last week.
 for r in
  select distinct on (e.id) e.id, regexp_replace(es.source_url,'\?date=\d+$','') url
  from public.events e
  join public.event_sources es on es.event_id = e.id
  left join meets_private.price_checks c on c.event_id = e.id
  where coalesce(e.price_status,'unknown')='unknown'
    and e.status in ('published','pending_review')
    and coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date
    and es.source_url ~ '^https://[^/]+/lv/notikums/'
    and (c.event_id is null or (c.status<>'queued' and c.checked_at < now()-interval '7 days'))
  order by e.id, es.id
  limit greatest(1,least(coalesce(p_batch,10),30))
 loop
  insert into meets_private.price_checks(event_id,source_url,request_id,status,queued_at)
  values(r.id,r.url,net.http_get(url:=r.url,timeout_milliseconds:=20000),'queued',now())
  on conflict (event_id) do update set source_url=excluded.source_url,request_id=excluded.request_id,
   status='queued',queued_at=now(),checked_at=null;
  n_new := n_new + 1;
 end loop;
 return jsonb_build_object('checked',n_done,'found',n_found,'asked',n_new);
end;
$$;
revoke all on function meets_private.price_check_tick(integer) from public, anon, authenticated;

select cron.schedule('meets-price-check','* * * * *','select meets_private.price_check_tick(10);');
