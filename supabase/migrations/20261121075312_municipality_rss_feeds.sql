-- Municipality RSS feeds (TVP platform /lv/rss/events) as the primary source,
-- with the weekly TVP HTML calendar read as a supplement.
--
-- * RSS is a format of meets_private.calendar_feeds (read every night by
--   sync-calendar-feeds), not a parallel system.
-- * One event = one row in public.events whether RSS, HTML or both found it.
--   The link is the event page address, normalised by tvp_url_key(): RSS
--   guid/link and the HTML source_url (".../lv/notikums/<slug>?date=0") give the
--   same key. RSS updates the HTML event it finds (import_key kept); HTML never
--   overwrites RSS fields and only fills empty ones.
-- * Council and committee sittings are skipped by calendar_feeds.skip_types: a
--   per-feed list of phrases matched against the item type and title. A separate
--   column is used rather than a special canonical value in
--   category_alias_mappings, because that table is the global category
--   vocabulary the events trigger applies to every import; a value meaning
--   "drop" would leak into categories of HTML and ICS events.
-- * event_sources.seen_via records which channel saw the row and when
--   ({"rss":"2026-11-21","html":"2026-11-18"}), shown in Admin.

-- Normalised event page address: host without www., path without query,
-- fragment and trailing slash. The same rule is in sync-calendar-feeds/rss.js.
create or replace function meets_private.tvp_url_key(p_url text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select nullif(regexp_replace(regexp_replace(
           lower(split_part(split_part(btrim(p_url),'#',1),'?',1)),
           '^[a-z][a-z0-9+.-]*://(www\.)?',''),'/+$',''),'')
$$;

create index if not exists event_sources_source_url_key_idx
  on public.event_sources(source_id,meets_private.tvp_url_key(source_url));

alter table public.event_sources
  add column if not exists seen_via jsonb not null default '{}'::jsonb;

-- Existing rows: the channel that wrote them, with the day they were last read.
update public.event_sources es
   set seen_via=jsonb_build_object(case
         when exists(select 1 from meets_private.source_registry r where r.source_id=es.source_id and r.source_format='tvp') then 'html'
         when exists(select 1 from meets_private.calendar_feeds f where f.source_id=es.source_id) then 'ics'
         else 'page' end,
       coalesce(es.retrieved_on,current_date))
 where es.seen_via='{}'::jsonb;

alter table meets_private.calendar_feeds
  add column if not exists feed_format text not null default 'ics',
  add column if not exists feed_format_locked boolean not null default false,
  add column if not exists skip_types text[] not null
    default array['domes sēde','komitejas sēde','komiteju sēde','ārkārtas sēde','pašvaldības darba kalendārs'],
  add column if not exists last_updated integer,
  add column if not exists last_skipped integer,
  add column if not exists last_feed_items integer,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_oldest_pub_at timestamptz,
  add column if not exists gap_detected_at timestamptz,
  add column if not exists zero_runs integer not null default 0;

do $$ begin
  alter table meets_private.calendar_feeds
    add constraint calendar_feeds_feed_format_check check (feed_format in ('ics','rss'));
exception when duplicate_object then null; end $$;

update meets_private.calendar_feeds set last_success_at=last_run_at
 where last_status='success' and last_success_at is null;

-- Feeds for the edge function.
create or replace function public.meets_calendar_feeds_for_sync(p_feed_id bigint default null)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'url',f.url,'label',f.label,'municipality_id',f.municipality_id,
           'source_id',f.source_id,'default_category',f.default_category,'feed_format',f.feed_format,
           'feed_format_locked',f.feed_format_locked,'skip_types',to_jsonb(f.skip_types)) order by f.id),'[]'::jsonb)
    from meets_private.calendar_feeds f
   where (p_feed_id is null and f.active) or f.id=p_feed_id
$$;

-- Result of one feed run. A gap: the oldest item in a full feed was published
-- after the previous successful read, so items may have dropped out between reads.
drop function if exists public.meets_calendar_feed_finished(bigint,text,integer,integer,text,bigint);
create function public.meets_calendar_feed_finished(
  p_feed_id bigint,p_status text,p_found integer,p_created integer,p_error text,p_source_id bigint,
  p_updated integer default null,p_skipped integer default null,p_format text default null,
  p_feed_items integer default null,p_oldest_pub timestamptz default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_prev timestamptz;
begin
  select last_success_at into v_prev from meets_private.calendar_feeds where id=p_feed_id;
  update meets_private.calendar_feeds
     set last_run_at=now(),last_status=p_status,last_error=p_error,
         last_found=coalesce(p_found,last_found),last_created=coalesce(p_created,last_created),
         last_updated=case when p_status='success' then p_updated else last_updated end,
         last_skipped=case when p_status='success' then p_skipped else last_skipped end,
         last_feed_items=case when p_status='success' then p_feed_items else last_feed_items end,
         source_id=coalesce(source_id,p_source_id),
         feed_format=case when not feed_format_locked and p_format in ('ics','rss') then p_format else feed_format end,
         last_success_at=case when p_status='success' then now() else last_success_at end,
         last_oldest_pub_at=case when p_status='success' then p_oldest_pub else last_oldest_pub_at end,
         gap_detected_at=case when p_status='success' and p_oldest_pub is not null and v_prev is not null
                                and coalesce(p_feed_items,0)>=20 and p_oldest_pub>v_prev
                              then now() else gap_detected_at end,
         zero_runs=case when p_status<>'success' then zero_runs
                        when coalesce(p_feed_items,p_found,0)=0 then zero_runs+1 else 0 end
   where id=p_feed_id;
end
$$;
revoke all on function public.meets_calendar_feed_finished(bigint,text,integer,integer,text,bigint,integer,integer,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.meets_calendar_feed_finished(bigint,text,integer,integer,text,bigint,integer,integer,text,integer,timestamptz) to service_role;

-- One event_sources row per event, source and page: an existing row with the
-- same page key (HTML "?date=0" or the RSS link) is refreshed, not duplicated.
create or replace function meets_private.feed_event_source(
  p_event_id uuid,p_source_id bigint,p_url text,p_channel text,p_day date,p_checked boolean default true)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_id bigint; v_key text:=meets_private.tvp_url_key(p_url);
begin
  select es.id into v_id from public.event_sources es
   where es.event_id=p_event_id and es.source_id=p_source_id
     and (meets_private.tvp_url_key(es.source_url)=v_key or es.seen_via ? p_channel)
   order by (meets_private.tvp_url_key(es.source_url)=v_key) desc,es.id limit 1;
  if v_id is not null then
    update public.event_sources es
       set retrieved_on=greatest(coalesce(es.retrieved_on,p_day),p_day),
           details_checked=es.details_checked or p_checked,
           seen_via=es.seen_via||jsonb_build_object(p_channel,p_day),
           source_url=case when meets_private.tvp_url_key(es.source_url)=v_key then es.source_url else coalesce(p_url,es.source_url) end
     where es.id=v_id;
  else
    insert into public.event_sources as t(event_id,source_id,source_url,retrieved_on,details_checked,seen_via)
    values(p_event_id,p_source_id,p_url,p_day,p_checked,jsonb_build_object(p_channel,p_day))
    on conflict(event_id,source_url) do update
      set retrieved_on=excluded.retrieved_on,
          seen_via=t.seen_via||excluded.seen_via;
  end if;
end
$$;

create or replace function public.meets_feed_event_source(p_event_id uuid,p_source_id bigint,p_url text,p_channel text,p_day date)
returns void
language sql
security definer
set search_path to ''
as $$ select meets_private.feed_event_source(p_event_id,p_source_id,p_url,p_channel,p_day,true) $$;
revoke all on function public.meets_feed_event_source(uuid,bigint,text,text,date) from public,anon,authenticated;
grant execute on function public.meets_feed_event_source(uuid,bigint,text,text,date) to service_role;

-- The event a feed item belongs to: by its own import key, else (same source)
-- an event whose page has the same key and whose dates overlap the item — the
-- HTML import's event. Other active events of the same page in those dates are
-- per-day HTML copies of the same event (exhibitions) and are archived.
-- Archived or cancelled events are returned with their status and left alone.
create or replace function public.meets_feed_event_match(
  p_feed_id bigint,p_import_key text,p_url text,p_date_from date,p_date_to date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_source bigint; v_key text:=meets_private.tvp_url_key(p_url);
        v_id uuid; v_status text; v_by text; v_merged integer:=0;
        v_to date:=coalesce(p_date_to,p_date_from);
begin
  select source_id into v_source from meets_private.calendar_feeds where id=p_feed_id;
  select e.id,e.status,'import_key' into v_id,v_status,v_by from public.events e where e.import_key=p_import_key;
  if v_id is null and v_source is not null and v_key is not null then
    select e.id,e.status,'url' into v_id,v_status,v_by
      from public.events e
      left join public.event_locations l on l.event_id=e.id
     where exists(select 1 from public.event_sources es
                   where es.event_id=e.id and es.source_id=v_source
                     and meets_private.tvp_url_key(es.source_url)=v_key)
       and e.date_from<=v_to and coalesce(e.date_to,e.date_from)>=p_date_from
     order by (e.status<>'archived') desc,(e.date_from=p_date_from) desc,(l.verified_at is not null) desc,
              (e.status='published') desc,e.created_at,e.id
     limit 1;
  end if;
  if v_id is not null and v_status not in ('archived','cancelled') and v_source is not null and v_key is not null then
    update public.events d
       set status='archived',updated_at=now(),
           last_change_summary=left('Apvienots ar RSS pasākumu '||v_id::text,200)
     where d.id<>v_id and d.status not in ('archived','cancelled')
       and d.date_from<=v_to and coalesce(d.date_to,d.date_from)>=p_date_from
       and exists(select 1 from public.event_sources es
                   where es.event_id=d.id and es.source_id=v_source
                     and meets_private.tvp_url_key(es.source_url)=v_key);
    get diagnostics v_merged=row_count;
  end if;
  return jsonb_build_object('event_id',v_id,'status',v_status,'matched_by',v_by,'merged',v_merged);
end
$$;
revoke all on function public.meets_feed_event_match(bigint,text,text,date,date) from public,anon,authenticated;
grant execute on function public.meets_feed_event_match(bigint,text,text,date,date) to service_role;

-- Admin → Avoti list.
create or replace function meets_private.admin_calendar_feeds(p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare today date:=(now() at time zone 'Europe/Riga')::date;
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return jsonb_build_object(
    'feeds',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',f.id,'url',f.url,'label',f.label,'municipality_id',f.municipality_id,'municipality',m.name,
        'default_category',f.default_category,'active',f.active,'last_run_at',f.last_run_at,'last_status',f.last_status,
        'last_error',f.last_error,'last_found',f.last_found,'last_created',f.last_created,'last_updated',f.last_updated,
        'last_skipped',f.last_skipped,'last_feed_items',f.last_feed_items,'last_success_at',f.last_success_at,
        'feed_format',f.feed_format,'feed_format_locked',f.feed_format_locked,'skip_types',to_jsonb(f.skip_types),
        'gap_detected_at',f.gap_detected_at,'zero_runs',f.zero_runs,
        'upcoming',(select count(*) from public.events e where coalesce(e.date_to,e.date_from)>=today and e.status<>'archived'
                      and (e.import_key like f.feed_format||':'||f.id||':%'
                           or exists(select 1 from public.event_sources es where es.event_id=e.id and es.source_id=f.source_id
                                       and es.seen_via ? f.feed_format))),
        'published',(select count(*) from public.events e where coalesce(e.date_to,e.date_from)>=today and e.status='published'
                      and (e.import_key like f.feed_format||':'||f.id||':%'
                           or exists(select 1 from public.event_sources es where es.event_id=e.id and es.source_id=f.source_id
                                       and es.seen_via ? f.feed_format)))
      ) order by f.feed_format desc,f.label),'[]'::jsonb)
      from meets_private.calendar_feeds f left join public.municipalities m on m.id=f.municipality_id),
    'municipalities',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb)
      from public.municipalities where name ~ ' (novads|valstspilsēta)$'));
end
$$;

-- Save a feed. p_feed_format null = recognised from the content on each read.
drop function if exists public.meets_admin_save_calendar_feed(text,bigint,text,text,bigint,text,boolean);
drop function if exists meets_private.admin_save_calendar_feed(text,bigint,text,text,bigint,text,boolean);
create function meets_private.admin_save_calendar_feed(
  p_session_token text,p_id bigint,p_url text,p_label text,p_municipality_id bigint,p_default_category text,p_active boolean,
  p_feed_format text,p_skip_types text[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_id bigint; v_url text:=btrim(coalesce(p_url,'')); v_run boolean;
        v_format text:=nullif(lower(btrim(coalesce(p_feed_format,''))),'');
        v_skip text[]:=(select coalesce(array_agg(distinct lower(btrim(x))) filter (where btrim(x)<>''),'{}')
                          from unnest(coalesce(p_skip_types,'{}'::text[])) x);
        v_default_skip text[]:=array['domes sēde','komitejas sēde','komiteju sēde','ārkārtas sēde','pašvaldības darba kalendārs'];
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  v_url:=regexp_replace(v_url,'^webcal://','https://','i');
  if v_url !~ '^https?://[^/\s]+\.[^/\s]+' then raise exception 'Ievadi pilnu kalendāra saiti (https://…)' using errcode='22023'; end if;
  if length(btrim(coalesce(p_label,''))) not between 2 and 120 then raise exception 'Ievadi avota nosaukumu' using errcode='22023'; end if;
  if v_format is not null and v_format not in ('ics','rss') then raise exception 'Formāts var būt ICS vai RSS' using errcode='22023'; end if;
  if v_format is null and v_url ~* '/rss(/|$|\?)|\.rss$|/feed/?$' then v_format:='rss'; end if;
  if p_id is null then
    insert into meets_private.calendar_feeds(url,label,municipality_id,default_category,active,feed_format,feed_format_locked,skip_types)
    values(v_url,btrim(p_label),p_municipality_id,nullif(btrim(coalesce(p_default_category,'')),''),coalesce(p_active,true),
           coalesce(v_format,'ics'),p_feed_format is not null and btrim(p_feed_format)<>'',
           case when p_skip_types is null then v_default_skip else v_skip end)
    returning id into v_id;
    v_run:=coalesce(p_active,true);
  else
    select coalesce(p_active,true) and not active into v_run from meets_private.calendar_feeds where id=p_id;
    update meets_private.calendar_feeds
       set url=v_url,label=btrim(p_label),municipality_id=p_municipality_id,
           default_category=nullif(btrim(coalesce(p_default_category,'')),''),active=coalesce(p_active,active),
           feed_format=coalesce(v_format,feed_format),
           feed_format_locked=p_feed_format is not null and btrim(p_feed_format)<>'',
           skip_types=case when p_skip_types is null then skip_types else v_skip end,
           updated_at=now()
     where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Kalendāra saite nav atrasta' using errcode='P0002'; end if;
  end if;
  if v_run then perform meets_private.run_calendar_feeds(v_id); end if;
  return jsonb_build_object('id',v_id,'started',coalesce(v_run,false));
exception when unique_violation then
  raise exception 'Šī kalendāra saite jau ir pievienota' using errcode='23505';
end
$$;

create function public.meets_admin_save_calendar_feed(
  p_session_token text default null,p_id bigint default null,p_url text default null,p_label text default null,
  p_municipality_id bigint default null,p_default_category text default null,p_active boolean default true,
  p_feed_format text default null,p_skip_types text[] default null)
returns jsonb
language sql
security definer
set search_path to ''
as $$ select meets_private.admin_save_calendar_feed(p_session_token,p_id,p_url,p_label,p_municipality_id,p_default_category,
        p_active,p_feed_format,p_skip_types) $$;
revoke all on function public.meets_admin_save_calendar_feed(text,bigint,text,text,bigint,text,boolean,text,text[]) from public,anon;
grant execute on function public.meets_admin_save_calendar_feed(text,bigint,text,text,bigint,text,boolean,text,text[]) to authenticated,service_role;

-- Weekly TVP HTML import. Changes from the previous version:
-- 1. an event of the same page (tvp_url_key) whose dates cover the candidate's
--    date is found first, so RSS events and their per-day HTML copies are reused;
-- 2. a found event is never overwritten: only empty fields are filled (start and
--    end time on a one-day event, category, venue of an unverified place), and the
--    HTML category badge is added to the event's categories;
-- 3. event_sources goes through feed_event_source (no second row for the same page).
create or replace function meets_private.municipality_sync_finalize_source(p_run uuid, p_source bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
 state_row meets_private.municipality_sync_source_runs%rowtype;
 v_previous_count integer; current_count integer; n_failed integer; n_pending integer;
 e uuid; c record; new_count integer:=0; reused_count integer:=0; filled_count integer:=0; is_new boolean;
 backup_json jsonb; log_reason text; v_backup_count integer; v_rows integer;
 today date:=(now() at time zone 'Europe/Riga')::date;
begin
 select * into state_row from meets_private.municipality_sync_source_runs
 where run_id=p_run and source_id=p_source for update;
 if not found then raise exception 'Unknown source run'; end if;
 if state_row.state<>'running' then return jsonb_build_object('status',state_row.state);end if;
 select count(*) filter(where status='failed'),count(*) filter(where status='queued')
 into n_failed,n_pending from meets_private.municipality_refresh_pages
 where batch_id=p_run and source_id=p_source;
 if n_pending>0 then return jsonb_build_object('status','waiting','pages',n_pending);end if;
 select count(*) into current_count from meets_private.municipality_sync_candidates
 where run_id=p_run and source_id=p_source;
 select event_count into v_previous_count from meets_private.municipality_sync_backups
 where source_id=p_source order by created_at desc,id desc limit 1;
 if n_failed>0 then log_reason:='Ielāde neizdevās: '||n_failed||' kalendāra lapas kļūdas';
 elsif current_count=0 then log_reason:='Avotā nav atrasts neviens derīgs pasākums';
 elsif coalesce(v_previous_count,0)>0 and current_count*2<v_previous_count then
  log_reason:='Ielāde noraidīta: '||current_count||' < 50% no '||v_previous_count||' iepriekšējiem pasākumiem';
 end if;
 if log_reason is not null then
  update meets_private.municipality_sync_source_runs set state='fallback',finished_at=now(),
   previous_count=v_previous_count,unique_count=current_count,detail=log_reason
  where run_id=p_run and source_id=p_source;
  update meets_private.source_registry set last_attempt_at=now(),last_status='partial',last_error=log_reason,
   last_result=jsonb_build_object('state','fallback','run_id',p_run,'active_previous_count',v_previous_count,
   'incoming_count',current_count,'reason',log_reason,'attempted_at',now())
  where source_id=p_source;
  return jsonb_build_object('status','fallback','reason',log_reason,'previous_count',v_previous_count,'current_count',current_count);
 end if;
 for c in select * from meets_private.municipality_sync_candidates
   where run_id=p_run and source_id=p_source order by event_date,title_key
 loop
  e:=null; is_new:=false;
  -- 1. Same page, dates covering this day (RSS event or the HTML event itself).
  select ev.id into e
  from public.events ev
  where ev.status<>'archived'
    and c.event_date between ev.date_from and coalesce(ev.date_to,ev.date_from)
    and exists(select 1 from public.event_sources es where es.event_id=ev.id and es.source_id=p_source
                 and meets_private.tvp_url_key(es.source_url)=meets_private.tvp_url_key(c.source_url))
  order by (ev.import_key like 'rss:%') desc,(ev.date_from=c.event_date) desc,
           case when ev.status='published' then 0 else 1 end,ev.created_at,ev.id limit 1;
  -- 2. Same day and title.
  if e is null then
   select ev.id into e
   from public.events ev
   join public.event_sources es on es.event_id=ev.id and es.source_id=p_source
   where ev.date_from=c.event_date
     and lower(btrim(regexp_replace(coalesce(ev.title,''),'[[:space:]]+',' ','g')))=c.title_key
   order by case when ev.status='published' then 0 else 1 end,ev.created_at,ev.id limit 1;
  end if;
  -- 3. Same address as written.
  if e is null then
   select ev.id into e from public.events ev
    join public.event_sources es on es.event_id=ev.id and es.source_id=p_source
   where es.source_url=c.source_url order by ev.created_at,ev.id limit 1;
  end if;
  if e is null then
   insert into public.events(import_key,title,description,date_from,date_to,time_from,time_to,
    time_type,schedule_type,attendance_mode,record_type,status,price_status,review_status,quality_flags,import_run_id,primary_category)
   values(encode(extensions.digest(p_source::text||'|'||c.event_date::text||'|'||c.title_key,'sha256'),'hex'),
    c.title,'',c.event_date,c.event_date,c.time_from,c.time_to,
    case when c.time_from is null then 'unspecified' when c.time_to is null then 'start_only' else 'fixed_interval' end,
    'single_day','in_person','event','pending_review','unknown','needs_review',
    array['municipality_weekly_sync','location_unverified'],p_run,nullif(c.category,''))
   on conflict(import_key) do nothing returning id into e;
   if e is null then
    select id into e from public.events
     where import_key=encode(extensions.digest(p_source::text||'|'||c.event_date::text||'|'||c.title_key,'sha256'),'hex');
   else
    is_new:=true;
    insert into public.event_locations(event_id,venue_name,address_raw,municipality_id,source_municipality_id,location_precision,location_quality,location_note,municipality_basis,country_code)
    select e,c.venue,c.venue,s.municipality_id,s.municipality_id,'unresolved','missing_point',
    'Jauns pašvaldības pasākums: pirms publicēšanas jāverificē adrese.',
    'Pašvaldības avots; norises teritorija jāverificē.','LV'
    from public.sources s where s.id=p_source;
    insert into public.event_occurrences(event_id,occurrence_key,occurrence_kind,date_from,date_to,time_from,time_to,time_type,starts_at,ends_at)
    values(e,'source','confirmed_date',c.event_date,c.event_date,c.time_from,c.time_to,
     case when c.time_from is null then 'unspecified' when c.time_to is null then 'start_only' else 'fixed_interval' end,
     case when c.time_from is null then null else (c.event_date+c.time_from) at time zone 'Europe/Riga' end,
     case when c.time_to is null then null else (c.event_date+c.time_to) at time zone 'Europe/Riga' end)
    on conflict(event_id,occurrence_key) do nothing;
    new_count:=new_count+1;
   end if;
  end if;
  if e is not null and not is_new then
   -- Fill only what is empty; RSS and admin values stay.
   update public.events ev
      set time_from=coalesce(ev.time_from,c.time_from),
          time_to=case when ev.time_to is null and c.time_to is not null
                        and (ev.time_from is null or ev.time_from=c.time_from) then c.time_to else ev.time_to end,
          primary_category=coalesce(ev.primary_category,nullif(c.category,'')),
          updated_at=now()
    where ev.id=e and ev.status not in ('archived','cancelled')
      and ev.date_from=c.event_date and coalesce(ev.date_to,ev.date_from)=c.event_date
      and ((ev.time_from is null and c.time_from is not null)
        or (ev.time_to is null and c.time_to is not null and (ev.time_from is null or ev.time_from=c.time_from))
        or (ev.primary_category is null and nullif(c.category,'') is not null));
   get diagnostics v_rows=row_count;
   if v_rows>0 then
    filled_count:=filled_count+1;
    update public.events ev
       set time_type=case when ev.time_from is null then 'unspecified' when ev.time_to is null then 'start_only' else 'fixed_interval' end
     where ev.id=e;
    update public.event_occurrences o
       set time_from=ev.time_from,time_to=ev.time_to,time_type=ev.time_type,
           starts_at=case when ev.time_from is null then null else (o.date_from+ev.time_from) at time zone 'Europe/Riga' end,
           ends_at=case when ev.time_to is null then null else (coalesce(o.date_to,o.date_from)+ev.time_to) at time zone 'Europe/Riga' end
      from public.events ev
     where ev.id=e and o.event_id=e and o.occurrence_key='source';
   end if;
   update public.event_locations l
      set venue_name=c.venue,address_raw=coalesce(nullif(btrim(l.address_raw),''),c.venue)
    where l.event_id=e and l.verified_at is null and nullif(btrim(coalesce(l.venue_name,'')),'') is null
      and nullif(btrim(coalesce(c.venue,'')),'') is not null;
  end if;
  if e is not null then
   if c.category is not null and length(c.category) between 1 and 200 then
    insert into public.categories(name) values(c.category) on conflict(name) do nothing;
    insert into public.event_categories(event_id,category_id)
     select e,id from public.categories where name=c.category on conflict do nothing;
   end if;
   perform meets_private.feed_event_source(e,p_source,c.source_url,'html',today,false);
   if not exists(select 1 from public.events x where x.id=e and x.import_run_id=p_run) then
    reused_count:=reused_count+1;
   end if;
  end if;
 end loop;
 select coalesce(jsonb_agg(
  jsonb_build_object('title',x.title,'date_from',x.event_date,'url',x.source_url,
   'venue',x.venue,'category',x.category,'time_from',x.time_from,'time_to',x.time_to)
  order by x.event_date,x.title_key),'[]'::jsonb)
 into backup_json from meets_private.municipality_sync_candidates x
 where x.run_id=p_run and x.source_id=p_source;
 insert into meets_private.municipality_sync_backups(source_id,run_id,event_count,events,origin)
 values(p_source,p_run,current_count,backup_json,'weekly');
 delete from meets_private.municipality_sync_backups b where b.source_id=p_source and b.id not in
  (select id from meets_private.municipality_sync_backups where source_id=p_source
   order by created_at desc,id desc limit 2);
 select count(*) into v_backup_count from meets_private.municipality_sync_backups where source_id=p_source;
 update meets_private.municipality_sync_source_runs set state='accepted',finished_at=now(),
  previous_count=v_previous_count,unique_count=current_count,added_count=new_count,
  matched_count=reused_count,detail='Validēta ielāde; iepriekšējie notikumi nav dzēsti'
 where run_id=p_run and source_id=p_source;
 update meets_private.source_registry set last_attempt_at=now(),last_read_at=now(),last_status='success',last_error=null,
  last_result=jsonb_build_object('state','accepted','run_id',p_run,'incoming_count',current_count,
   'previous_count',v_previous_count,'added',new_count,'matched',reused_count,'filled',filled_count,
   'backups',v_backup_count,'completed_at',now())
 where source_id=p_source;
 update public.sources set retrieved_on=today where id=p_source;
 return jsonb_build_object('status','accepted','items',current_count,'new',new_count,'matched',reused_count,
  'filled',filled_count,'backups',v_backup_count);
end $function$;

-- Import health (admin digest and Admin → Avoti): RSS problems added.
create or replace function meets_private.import_problems()
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  with runs as (
    select case
             when source_key like 'athletics-lv-%' then 'Vieglatlētika'
             when source_key like 'lff%' then 'Futbols (LFF)'
             when source_key like 'estlatbl-%' then 'Latvijas–Igaunijas basketbola līga'
             when source_key like 'lbs-sportradar-%' then 'Basketbols (LBS)'
             when source_key like 'handball-%' then 'Handbols'
             when source_key like 'hockey-%' then 'Hokejs (LHF)'
             when source_key like 'volleyball-%' then 'Volejbols (LVF)'
             when source_key like 'floorball-%' then 'Florbols (LFS)'
             when source_key like 'sigulda-%' then 'Siguldas novads'
           end family,*
      from public.import_runs
  ), families as (
    select f.family,
           max(r.completed_at) filter (where r.status in ('complete','completed')) last_success,
           (array_agg(r.status order by r.imported_at desc))[1] last_status,
           (array_agg(r.error_text order by r.imported_at desc))[1] last_error,
           max(r.imported_at) last_attempt
      from (values ('Vieglatlētika'),('Futbols (LFF)'),('Latvijas–Igaunijas basketbola līga'),('Basketbols (LBS)'),('Handbols'),
                   ('Hokejs (LHF)'),('Volejbols (LVF)'),('Florbols (LFS)'),('Siguldas novads')) f(family)
      left join runs r on r.family=f.family
     group by f.family
  )
  select coalesce(array_agg(line order by line),'{}') from (
    select family||': '||case
             when last_status='failed' and last_attempt>now()-interval '1 day'
               then 'ielāde neizdevās'||coalesce(' — '||left(last_error,160),'')
             else 'nav veiksmīgas ielādes kopš '||coalesce(to_char(last_success at time zone 'Europe/Riga','DD.MM.'),'sākuma')
           end line
      from families
     where (last_status='failed' and last_attempt>now()-interval '1 day')
        or last_success is null or last_success<now()-interval '8 days'
    union all
    select coalesce(r.display_name,s.domain)||': '||coalesce(sr.detail,'ielāde neizdevās')||' — rāda iepriekšējo kopiju'
      from meets_private.municipality_sync_source_runs sr
      join public.sources s on s.id=sr.source_id
      left join meets_private.source_registry r on r.source_id=sr.source_id
     where sr.state='fallback' and sr.finished_at>now()-interval '1 day'
    union all
    select case when f.feed_format='rss' then 'RSS plūsma “' else 'Kalendāra saite “' end||f.label||'”: '||coalesce(f.last_error,'ielāde neizdevās')
      from meets_private.calendar_feeds f
     where f.active and f.last_status='failed' and f.last_run_at>now()-interval '1 day'
    union all
    select 'RSS plūsma “'||f.label||'”: '||f.zero_runs||' ielādes pēc kārtas bez neviena ieraksta'
      from meets_private.calendar_feeds f
     where f.active and f.feed_format='rss' and f.zero_runs>=3
    union all
    select 'RSS plūsma “'||f.label||'”: starp ielādēm varēja pazust ieraksti (vecākais ieraksts jaunāks par iepriekšējo ielādi) — jāielādē biežāk'
      from meets_private.calendar_feeds f
     where f.active and f.feed_format='rss' and f.gap_detected_at>now()-interval '1 day'
    union all
    select case when f.feed_format='rss' then 'RSS plūsma “' else 'Kalendāra saite “' end||f.label||'”: nav veiksmīgas ielādes kopš '
           ||coalesce(to_char(f.last_success_at at time zone 'Europe/Riga','DD.MM.'),'pievienošanas')
      from meets_private.calendar_feeds f
     where f.active and f.created_at<now()-interval '2 days'
       and (f.last_success_at is null or f.last_success_at<now()-interval '2 days')
       and not (f.last_status='failed' and f.last_run_at>now()-interval '1 day')
  ) lines
$function$;

-- Admin event list: every source row says which channels saw it.
create or replace function meets_private.read_admin_catalog_rows(p_session_token text, p_past boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  return jsonb_build_object(
    'fetchedAt',now(),
    'fields',jsonb_build_array('id','title','description','date_from','date_to','time_from','time_to','time_type',
      'attendance_mode','record_type','event_type','primary_category','status','price_status','price_min','price_max',
      'venue_name','address_raw','location_precision','municipality','settlement','country_code','latitude','longitude',
      'location_quality','location_review_reason','geocode_query','geocode_candidates','geocode_suggested_at',
      'governing_body','competition_name','sport_format','tags','sources','location_auto'),
    'rows',(
      select coalesce(jsonb_agg(jsonb_build_array(
        c.id,c.title,c.description,c.date_from,c.date_to,c.time_from,c.time_to,c.time_type,
        c.attendance_mode,c.record_type,c.event_type,c.primary_category,c.status,c.price_status,c.price_min,c.price_max,
        c.venue_name,c.address_raw,c.location_precision,c.municipality,c.settlement,c.country_code,c.latitude,c.longitude,
        c.location_quality,c.location_review_reason,c.geocode_query,c.geocode_candidates,c.geocode_suggested_at,
        c.governing_body,c.competition_name,c.sport_format,c.tags,c.sources,c.location_auto
      ) order by c.date_from,c.id),'[]'::jsonb)
      from (
        select v.id,v.title,left(regexp_replace(coalesce(v.description,''),'\s+',' ','g'),300) as description,
               v.date_from,v.date_to,v.time_from,v.time_to,v.time_type,v.attendance_mode,v.record_type,v.event_type,
               v.primary_category,v.status,v.price_status,v.price_min,v.price_max,
               v.venue_name,v.address_raw,v.location_precision,v.municipality,v.settlement,v.country_code,
               round(v.latitude::numeric,6) as latitude,round(v.longitude::numeric,6) as longitude,
               l.location_quality,l.location_review_reason,l.geocode_query,
               nullif(l.geocode_candidates,'[]'::jsonb) as geocode_candidates,l.geocode_suggested_at,
               sc.governing_body,sc.name as competition_name,coalesce(sm.sport_format,sc.sport_format) as sport_format,
               (select nullif(jsonb_agg(c.name order by c.name),'[]'::jsonb)
                  from public.event_categories ec
                  join public.categories c on c.id=ec.category_id
                 where ec.event_id=v.id) as tags,
               (select coalesce(jsonb_agg(jsonb_build_object('source',s.domain,'url',es.source_url,
                         'via',(select jsonb_agg(k order by k) from jsonb_object_keys(es.seen_via) k),
                         'seen',nullif(es.seen_via,'{}'::jsonb)) order by es.id),'[]'::jsonb)
                  from public.event_sources es
                  join public.sources s on s.id=es.source_id
                 where es.event_id=v.id) as sources,
               (select ap.method from meets_private.location_auto_places ap
                 where ap.id=l.location_auto_place_id and ap.active) as location_auto
          from public.event_overview v
          left join public.event_locations l on l.event_id=v.id
          left join public.event_sports_metadata sm on sm.event_id=v.id
          left join public.sports_competitions sc on sc.id=sm.competition_id
         where case when p_past
                 then coalesce(v.date_to,v.date_from) between (now() at time zone 'Europe/Riga')::date-14 and (now() at time zone 'Europe/Riga')::date-1
                 else coalesce(v.date_to,v.date_from)>=(now() at time zone 'Europe/Riga')::date end
      ) c
    )
  );
end
$function$;

-- Per municipality: which source is used and how its events are doing.
create or replace function meets_private.municipality_source_overview()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with today as (select (now() at time zone 'Europe/Riga')::date d),
  mun as (select id,name from public.municipalities where name ~ ' (novads|valstspilsēta)$'),
  src as (
    select s.id,s.domain,s.municipality_id,
           exists(select 1 from meets_private.source_registry r where r.source_id=s.id and r.source_format='tvp') tvp,
           (select r.last_read_at from meets_private.source_registry r where r.source_id=s.id) tvp_read,
           (select r.last_status from meets_private.source_registry r where r.source_id=s.id) tvp_status,
           (select r.last_error from meets_private.source_registry r where r.source_id=s.id) tvp_error
      from public.sources s where s.municipality_id is not null),
  feeds as (
    select f.*,coalesce(f.municipality_id,s.municipality_id) mid
      from meets_private.calendar_feeds f left join public.sources s on s.id=f.source_id
     where f.active),
  ev as (
    select distinct s.municipality_id mid,e.id,e.status,e.primary_category,e.primary_category_raw,
           l.verified_at,l.location_precision
      from src s
      join public.event_sources es on es.source_id=s.id
      join public.events e on e.id=es.event_id
      left join public.event_locations l on l.event_id=e.id
     where coalesce(e.date_to,e.date_from)>=(select d from today) and e.status<>'archived'),
  canon as (select distinct meets_private.normalize_category_alias(canonical_category) c from meets_private.category_alias_mappings where active
            union select alias_normalized from meets_private.category_alias_mappings where active)
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.name),'[]'::jsonb) from (
    select m.id,m.name,
      case
        when rss.n>0 and tvp.n>0 then 'RSS + HTML'
        when rss.n>0 then 'RSS'
        when ics.n>0 and tvp.n>0 then 'ICS + HTML'
        when ics.n>0 then 'ICS'
        when tvp.n>0 then 'HTML'
        when own.n>0 then 'Sava lapa'
        else 'Nav avota' end source_kind,
      (select jsonb_agg(jsonb_build_object('format',f.feed_format,'url',f.url,'label',f.label,'last_status',f.last_status,
               'last_success_at',f.last_success_at,'last_error',f.last_error) order by f.feed_format desc,f.id)
         from feeds f where f.mid=m.id) feeds,
      (select string_agg(s.domain,', ' order by s.domain) from src s where s.municipality_id=m.id) domains,
      case when rss.n+ics.n>0 and tvp.n>0 then 'katru nakti (plūsma) + trešdienās (HTML)'
           when rss.n+ics.n>0 then 'katru nakti'
           when tvp.n+own.n>0 then 'reizi nedēļā (trešdienās)' end frequency,
      greatest(
        (select max(f.last_success_at) from feeds f where f.mid=m.id),
        (select max(s.tvp_read) from src s where s.municipality_id=m.id and s.tvp),
        (select max(es.retrieved_on)::timestamptz from src s join public.event_sources es on es.source_id=s.id
          where s.municipality_id=m.id and not s.tvp and not exists(select 1 from meets_private.calendar_feeds f where f.source_id=s.id))
      ) last_success_at,
      nullif(concat_ws('; ',
        (select string_agg(case when f.feed_format='rss' then 'RSS' else 'ICS' end||': '||left(coalesce(f.last_error,'kļūda'),120),'; ')
           from feeds f where f.mid=m.id and f.last_status='failed'),
        (select string_agg('HTML: '||left(coalesce(s.tvp_error,'daļēja ielāde'),120),'; ')
           from src s where s.municipality_id=m.id and s.tvp and s.tvp_status is distinct from 'success')),'') problem,
      (select count(*) from ev where ev.mid=m.id) future_events,
      (select count(*) from ev where ev.mid=m.id and ev.status='published') published_events,
      (select count(*) from ev where ev.mid=m.id and ev.status<>'published' and ev.verified_at is null) pending_locations,
      (select count(distinct meets_private.normalize_category_alias(coalesce(ev.primary_category_raw,ev.primary_category)))
         from ev where ev.mid=m.id and coalesce(ev.primary_category_raw,ev.primary_category) is not null
          and meets_private.normalize_category_alias(coalesce(ev.primary_category_raw,ev.primary_category)) not in (select c from canon)
          and meets_private.normalize_category_alias(ev.primary_category) not in (select c from canon)) unmapped_categories
    from mun m
    cross join lateral (select count(*) n from feeds f where f.mid=m.id and f.feed_format='rss') rss
    cross join lateral (select count(*) n from feeds f where f.mid=m.id and f.feed_format='ics') ics
    cross join lateral (select count(*) n from src s where s.municipality_id=m.id and s.tvp) tvp
    cross join lateral (select count(*) n from src s where s.municipality_id=m.id and not s.tvp
                          and not exists(select 1 from meets_private.calendar_feeds f where f.source_id=s.id)) own
  ) x
$$;

create or replace function meets_private.admin_municipality_sources(p_session_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return meets_private.municipality_source_overview();
end
$$;

create or replace function public.meets_admin_municipality_sources(p_session_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$ select meets_private.admin_municipality_sources(p_session_token) $$;
revoke all on function public.meets_admin_municipality_sources(text) from public,anon;
grant execute on function public.meets_admin_municipality_sources(text) to authenticated,service_role;

-- The eight municipalities that publish an RSS feed (checked 21.11.2026). The
-- source is the municipality's existing TVP source, so RSS and HTML events link.
insert into meets_private.calendar_feeds(url,label,municipality_id,source_id,default_category,active,feed_format,feed_format_locked)
select 'https://www.'||s.domain||'/lv/rss/events',m.name||' (RSS)',s.municipality_id,s.id,null,true,'rss',true
  from public.sources s
  join public.municipalities m on m.id=s.municipality_id
  join meets_private.source_registry r on r.source_id=s.id and r.source_format='tvp'
 where s.domain in ('riga.lv','jurmala.lv','adazunovads.lv','ropazi.lv','jelgavasnovads.lv','limbazunovads.lv','preili.lv','tukums.lv')
on conflict(url) do nothing;
