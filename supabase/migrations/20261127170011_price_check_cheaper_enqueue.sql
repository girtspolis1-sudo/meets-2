-- price_check_tick runs every minute. Most runs have nothing to do, yet the query that
-- picks the next pages looked up the sources of every upcoming event one by one before
-- applying the address pattern (~10 000 buffer pages, median run 139 ms). The pattern
-- now selects the matching source addresses first (one pass over event_sources,
-- ~1 000 pages). Same rows, same order, same limit; the rest of the function is unchanged.
-- The queued checks get a small partial index for the first loop.

create index if not exists price_checks_queued_idx
  on meets_private.price_checks (queued_at) where status = 'queued';

create or replace function meets_private.price_check_tick(p_batch integer default 10)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  with ps as materialized (
   -- Event pages of municipality calendars, found in one pass over the sources.
   select es.event_id, es.id, es.source_url
   from public.event_sources es
   where es.source_url ~ '^https://[^/]+/lv/notikums/'
  )
  select distinct on (e.id) e.id, regexp_replace(ps.source_url,'\?date=\d+$','') url
  from ps
  join public.events e on e.id = ps.event_id
  left join meets_private.price_checks c on c.event_id = e.id
  where (coalesce(e.price_status,'unknown')='unknown' or c.online_checked is not true)
    and e.status in ('published','pending_review')
    and coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date
    and (c.event_id is null
      or (c.status<>'queued' and c.checked_at < now()-interval '7 days')
      or (c.status<>'queued' and c.online_checked is not true))
  order by e.id, ps.id
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
$function$;
