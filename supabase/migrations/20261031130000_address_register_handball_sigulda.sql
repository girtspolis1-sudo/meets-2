-- 1. Valsts adrešu reģistrs (VZD open data, aw_eka.csv): street addresses with
--    coordinates, loaded in 5 MB parts by the load-address-register edge function.
--    The background place search looks an address up here before anything else.
-- 2. Handball (handball.lv) and Sigulda (sigulda.lv) imports: weekly cron jobs,
--    shown in import health and the daily digest.

create table if not exists meets_private.address_register(
  kods bigint primary key,
  std text not null,
  house_key text not null,
  places text not null,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);
create index if not exists address_register_house_key on meets_private.address_register(house_key);
revoke all on meets_private.address_register from public,anon,authenticated;

create table if not exists meets_private.address_register_load(
  id integer primary key default 1 check (id=1),
  state text not null default 'idle' check (state in ('idle','running','done','failed')),
  next_offset bigint not null default 0,
  total_bytes bigint,
  rows_loaded integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
insert into meets_private.address_register_load(id) values(1) on conflict do nothing;
revoke all on meets_private.address_register_load from public,anon,authenticated;

-- "Gaujas ielā 1" and "Gaujas iela 1", "14 A" and "14A" give the same key.
create or replace function meets_private.address_key(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    ' '||meets_private.plain_text(p_text)||' ',
    ' bulvari ',' bulvaris ','g'),' prospekta ',' prospekts ','g'),' laukuma ',' laukums ','g'),
    ' cela ',' cels ','g'),' dambi ',' dambis ','g'),
    '([0-9]) ([a-z])( |$)','\1\2\3','g'))
$$;

-- A street address in the text ("…, Kalēju iela 9/11, LV-1050") found in the register.
-- Candidates must lie in the municipality or a town the text names; "unique" marks one clear answer.
create or replace function meets_private.address_register_lookup(p_text text, p_municipality text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_segment text;
  v_match text;
  v_words text[];
  v_keys text[] := '{}';
  v_area text := nullif(left(meets_private.plain_text(regexp_replace(coalesce(p_municipality,''),' (valstspilsēta|novads)$','')),4),'');
  v_towns text[];
  v_found jsonb;
begin
  foreach v_segment in array regexp_split_to_array(coalesce(p_text,''),'[,;()]') loop
    v_match := substring(v_segment from '((?:\S+\s+){0,4}(?:iela|ielā|gatve|gatvē|bulvāris|bulvārī|prospekts|prospektā|laukums|laukumā|šoseja|šosejā|ceļš|ceļā|aleja|alejā|krastmala|krastmalā|līnija|līnijā|dambis|dambī)\s+\d+\s?[A-Za-z]?(?:\s?[/-]\s?\d+[A-Za-z]?)?)');
    continue when v_match is null;
    -- "Bibliotēka Kalēju iela 9": try the street name with fewer leading words too.
    v_words := regexp_split_to_array(btrim(v_match),'\s+');
    for i in 1..greatest(1,cardinality(v_words)-2) loop
      v_keys := v_keys||meets_private.address_key(array_to_string(v_words[i:],' '));
    end loop;
  end loop;
  if cardinality(v_keys)=0 then return '[]'::jsonb; end if;

  select array_agg(t) into v_towns
    from regexp_split_to_table(meets_private.plain_text(p_text),' ') t
   where length(t)>=4 and t !~ '^[0-9]+$' and t not in ('iela','novads','pagasts','gatve','laukums','prospekts');

  with hits as (
    select a.*,
           (v_area is not null and position(v_area in a.places)>0)
           or exists (select 1 from unnest(v_towns) t where position(' '||t||' ' in ' '||a.places||' ')>0) in_area
      from meets_private.address_register a
     where a.house_key = any(v_keys)
  ), chosen as (
    select * from hits where in_area or (v_area is null and (select count(*) from hits)=1)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id','var:'||kods,'label',split_part(std,', ',1),'displayName',std,
           'latitude',latitude,'longitude',longitude,'type','address','category','building',
           'source','Valsts adrešu reģistrs','score',10,
           'unique',(select count(*) from chosen)=1) order by kods),'[]'::jsonb)
    into v_found
    from (select * from chosen order by kods limit 3) c;
  return v_found;
end
$$;

-- Edge function interface (service role only): where to continue, and one loaded part.
create or replace function public.meets_address_register_next()
returns jsonb
language sql
security definer
set search_path to ''
as $$
  select jsonb_build_object('state',state,'offset',next_offset,'total',total_bytes)
    from meets_private.address_register_load where id=1
$$;

create or replace function public.meets_address_register_import(p_from bigint, p_next bigint, p_total bigint, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_load meets_private.address_register_load%rowtype; v_count integer;
begin
  select * into v_load from meets_private.address_register_load where id=1 for update;
  -- A part already loaded by an overlapping run is ignored.
  if v_load.state<>'running' or v_load.next_offset<>p_from then
    return jsonb_build_object('skipped',true,'offset',v_load.next_offset);
  end if;
  insert into meets_private.address_register(kods,std,house_key,places,latitude,longitude)
  select (r->>0)::bigint, r->>1,
         meets_private.address_key(split_part(r->>1,', ',1)),
         meets_private.plain_text(regexp_replace(substr(r->>1,length(split_part(r->>1,', ',1))+3),',?\s*LV-\d{4}\s*$','')),
         (r->>2)::float8,(r->>3)::float8
    from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) r
  on conflict (kods) do update
     set std=excluded.std,house_key=excluded.house_key,places=excluded.places,
         latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now();
  get diagnostics v_count=row_count;
  update meets_private.address_register_load
     set next_offset=p_next,total_bytes=p_total,rows_loaded=rows_loaded+v_count,
         state=case when p_next>=p_total then 'done' else 'running' end,
         finished_at=case when p_next>=p_total then now() end,error=null
   where id=1;
  if p_next>=p_total then perform meets_private.address_register_apply(); end if;
  return jsonb_build_object('loaded',v_count,'offset',p_next,'done',p_next>=p_total);
end
$$;

create or replace function public.meets_address_register_failed(p_error text)
returns void
language sql
security definer
set search_path to ''
as $$
  update meets_private.address_register_load set error=left(p_error,500) where id=1;
$$;

revoke execute on function public.meets_address_register_next() from public,anon,authenticated;
revoke execute on function public.meets_address_register_import(bigint,bigint,bigint,jsonb) from public,anon,authenticated;
revoke execute on function public.meets_address_register_failed(text) from public,anon,authenticated;
grant execute on function public.meets_address_register_next() to service_role;
grant execute on function public.meets_address_register_import(bigint,bigint,bigint,jsonb) to service_role;
grant execute on function public.meets_address_register_failed(text) to service_role;

create or replace function meets_private.address_register_start()
returns void
language sql
security definer
set search_path to ''
as $$
  update meets_private.address_register_load
     set state='running',next_offset=0,rows_loaded=0,started_at=now(),finished_at=null,error=null
   where id=1;
$$;

-- The place search queue keeps a sample address for each place.
alter table meets_private.place_search_queue add column if not exists address_text text;

-- Register answers replace earlier suggestions for places still waiting.
create or replace function meets_private.address_register_apply()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare r record; v_found jsonb; v_count integer := 0;
begin
  for r in select q.venue_name,q.address_text,m.name municipality
             from meets_private.place_search_queue q
             left join public.municipalities m on m.id=q.municipality_id
            where coalesce(q.source,'')<>'Valsts adrešu reģistrs'
              and exists (select 1 from public.event_locations l where l.venue_name=q.venue_name and l.verified_at is null) loop
    v_found := meets_private.address_register_lookup(concat_ws(', ',r.venue_name,r.address_text),r.municipality);
    if jsonb_array_length(v_found)>0 then
      perform meets_private.place_search_store(r.venue_name,'Valsts adrešu reģistrs',v_found,'Valsts adrešu reģistrs');
      v_count := v_count+1;
    end if;
  end loop;
  return v_count;
end
$$;

-- Admin: how far the register load is.
create or replace function meets_private.admin_address_register_status(p_session_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return (select jsonb_build_object('state',state,'offset',next_offset,'total',total_bytes,'rows',rows_loaded,
            'startedAt',started_at,'finishedAt',finished_at,'error',error)
            from meets_private.address_register_load where id=1);
end
$$;
create or replace function public.meets_admin_address_register_status(p_session_token text default null)
returns jsonb language sql stable security definer set search_path to ''
as $$ select meets_private.admin_address_register_status(p_session_token) $$;
revoke execute on function public.meets_admin_address_register_status(text) from public,anon;
grant execute on function public.meets_admin_address_register_status(text) to authenticated;

create or replace function meets_private.place_search_enqueue()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  with places as (
    select l.venue_name,mode() within group (order by l.municipality_id) municipality_id,count(*) n,
           max(nullif(btrim(l.address_raw),'')) filter (where l.address_raw is distinct from l.venue_name) address_text
      from public.events e
      join public.event_locations l on l.event_id=e.id
     where e.status in ('pending_review','published')
       and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date
       and coalesce(e.attendance_mode,'')<>'online'
       and l.verified_at is null
       and coalesce(l.location_quality,'')<>'verified_exact'
       and length(btrim(coalesce(l.venue_name,'')))>=3
     group by l.venue_name
  )
  insert into meets_private.place_search_queue as q(venue_name,municipality_id,query,event_count,address_text)
  select p.venue_name,p.municipality_id,meets_private.place_search_query(p.venue_name,m.name),p.n,p.address_text
    from places p left join public.municipalities m on m.id=p.municipality_id
  on conflict(venue_name) do update
     set event_count=excluded.event_count,
         address_text=excluded.address_text,
         municipality_id=excluded.municipality_id,
         query=excluded.query,
         -- A place whose search text changed (e.g. its municipality became known) is searched again.
         state=case when q.query<>excluded.query and q.state in ('done','failed') then 'queued' else q.state end,
         attempts=case when q.query<>excluded.query and q.state in ('done','failed') then 0 else q.attempts end,
         known_checked_at=case when q.query<>excluded.query and q.state in ('done','failed') then null else q.known_checked_at end;
  get diagnostics v_count=row_count;

  -- Events imported after their place was searched get the same suggestions.
  update public.event_locations l
     set geocode_query=left(q.query,300),geocode_candidates=q.candidates,geocode_suggested_at=q.finished_at
    from meets_private.place_search_queue q
   where q.state='done' and l.venue_name=q.venue_name and l.verified_at is null and l.geocode_suggested_at is null;
  return v_count;
end
$$;

create or replace function meets_private.place_search_tick()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r record;
  v_response record;
  v_candidates jsonb;
  v_known jsonb;
  v_done integer := 0;
  v_sent boolean := false;
begin
  if not pg_try_advisory_xact_lock(201026,1131) then return jsonb_build_object('state','busy'); end if;

  -- 1. Answers to earlier searches.
  for r in select q.*,m.name municipality from meets_private.place_search_queue q
             left join public.municipalities m on m.id=q.municipality_id
            where q.state='requested' loop
    select status_code,content,error_msg into v_response from net._http_response where id=r.request_id;
    if not found then
      if r.requested_at<now()-interval '10 minutes' then
        update meets_private.place_search_queue
           set state=case when attempts>=3 then 'failed' else 'queued' end,error='Atbilde netika saņemta'
         where venue_name=r.venue_name;
      end if;
      continue;
    end if;
    v_candidates := null;
    if v_response.status_code=200 and v_response.content is not null then
      begin
        v_candidates := meets_private.place_search_candidates(v_response.content::jsonb,r.query,r.municipality);
      exception when others then v_candidates := null;
      end;
    end if;
    if v_candidates is null then
      update meets_private.place_search_queue
         set state=case when attempts>=3 then 'failed' else 'queued' end,
             error=left(coalesce(v_response.error_msg,'HTTP '||coalesce(v_response.status_code::text,'?')),300)
       where venue_name=r.venue_name;
    else
      perform meets_private.place_search_store(r.venue_name,r.query,v_candidates,'OpenStreetMap');
      v_done := v_done+1;
    end if;
  end loop;

  -- 2. The address register and places MEETS already knows answer without an outside request.
  for r in select q.venue_name,q.address_text,m.name municipality from meets_private.place_search_queue q
             left join public.municipalities m on m.id=q.municipality_id
            where q.state='queued' and q.known_checked_at is null
            order by q.event_count desc,q.venue_name limit 20 loop
    v_known := meets_private.address_register_lookup(concat_ws(', ',r.venue_name,r.address_text),r.municipality);
    if jsonb_array_length(v_known)>0 then
      perform meets_private.place_search_store(r.venue_name,'Valsts adrešu reģistrs',v_known,'Valsts adrešu reģistrs');
      v_done := v_done+1;
      continue;
    end if;
    select coalesce(jsonb_agg(x),'[]'::jsonb) into v_known
      from jsonb_array_elements(meets_private.match_known_places(r.venue_name,r.municipality)) x
     where (x->>'score')::numeric>=0.75 and coalesce((x->>'sameArea')::boolean,true)
       and meets_private.place_names_match(r.venue_name,(x->>'label')||' '||coalesce(x->>'displayName',''));
    if jsonb_array_length(v_known)>0 then
      perform meets_private.place_search_store(r.venue_name,'MEETS zināmās vietas',v_known,'MEETS');
      v_done := v_done+1;
    else
      update meets_private.place_search_queue set known_checked_at=now() where venue_name=r.venue_name;
    end if;
  end loop;

  -- 3. One OpenStreetMap search at a time (their usage policy allows one per second).
  if not exists(select 1 from meets_private.place_search_queue where state='requested') then
    select q.venue_name,q.query into r from meets_private.place_search_queue q
     where q.state='queued' and q.known_checked_at is not null
     order by q.attempts,q.event_count desc,q.venue_name limit 1;
    if found then
      update meets_private.place_search_queue
         set state='requested',attempts=attempts+1,requested_at=now(),
             request_id=net.http_get(
               url:='https://nominatim.openstreetmap.org/search',
               params:=jsonb_build_object('q',r.query,'format','jsonv2','limit','8','countrycodes','lv,ee,lt','accept-language','lv,en'),
               headers:=jsonb_build_object('User-Agent','MEETS/1.0 (+https://meets.lv; contact: girts.polis@icloud.com)','Accept','application/json'),
               timeout_milliseconds:=20000)
       where venue_name=r.venue_name;
      v_sent := true;
    end if;
  end if;
  return jsonb_build_object('stored',v_done,'sent',v_sent);
end
$$;

create or replace function meets_private.import_problems()
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  with runs as (
    select case
             when source_key like 'athletics-lv-%' then 'Vieglatlētika'
             when source_key like 'lff%' then 'Futbols (LFF)'
             when source_key like 'estlatbl-%' then 'Latvijas–Igaunijas basketbola līga'
             when source_key like 'lbs-sportradar-%' then 'Basketbols (LBS)'
             when source_key like 'handball-%' then 'Handbols'
             when source_key like 'sigulda-%' then 'Siguldas novads'
           end family,*
      from public.import_runs
  ), families as (
    select f.family,
           max(r.completed_at) filter (where r.status in ('complete','completed')) last_success,
           (array_agg(r.status order by r.imported_at desc))[1] last_status,
           (array_agg(r.error_text order by r.imported_at desc))[1] last_error,
           max(r.imported_at) last_attempt
      from (values ('Vieglatlētika'),('Futbols (LFF)'),('Latvijas–Igaunijas basketbola līga'),('Basketbols (LBS)'),('Handbols'),('Siguldas novads')) f(family)
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
  ) lines
$$;

create or replace function meets_private.admin_import_health(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_municipal_cron boolean;
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  select coalesce(bool_or(active),false) into v_municipal_cron from cron.job where jobname='meets-municipalities-weekly';

  return jsonb_build_object(
    'sports',(
      with runs as (
        select
          case
            when source_key like 'athletics-lv-%' then 'athletics'
            when source_key like 'lff%' then 'lff'
            when source_key like 'estlatbl-%' then 'estlat'
            when source_key like 'lbs-sportradar-%' then 'lbs'
            when source_key like 'handball-%' then 'handball'
            when source_key like 'sigulda-%' then 'sigulda'
            else null
          end as family,
          *
        from public.import_runs
      ),
      families as (
        select unnest(array['athletics','lff','estlat','lbs','handball','sigulda']) as family
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'key',f.family,
        'label',case f.family
          when 'athletics' then 'Athletics.lv'
          when 'lff' then 'LFF'
          when 'estlat' then 'Latvijas–Igaunijas basketbola līga'
          when 'lbs' then 'Basket.lv / LBS'
          when 'handball' then 'Handball.lv'
          when 'sigulda' then 'Siguldas novads (sigulda.lv)'
        end,
        'cron_active',coalesce((
          select j.active from cron.job j
          where j.jobname=case f.family
            when 'athletics' then 'sync-athletics-events-weekly'
            when 'lff' then 'sync-lff-events-weekly'
            when 'estlat' then 'sync-estlat-basketball-events'
            when 'lbs' then 'sync-lbs-basketball-events'
            when 'handball' then 'sync-handball-events'
            when 'sigulda' then 'sync-sigulda-events'
          end
          limit 1
        ),false),
        'schedule',(
          select j.schedule from cron.job j
          where j.jobname=case f.family
            when 'athletics' then 'sync-athletics-events-weekly'
            when 'lff' then 'sync-lff-events-weekly'
            when 'estlat' then 'sync-estlat-basketball-events'
            when 'lbs' then 'sync-lbs-basketball-events'
            when 'handball' then 'sync-handball-events'
            when 'sigulda' then 'sync-sigulda-events'
          end
          limit 1
        ),
        'last_attempt_at',latest.imported_at,
        'last_status',latest.status,
        'last_success_at',(
          select max(r2.completed_at)
          from runs r2
          where r2.family=f.family and r2.status in ('complete','completed')
        ),
        'expected_count',latest.expected_count,
        'imported_count',latest.imported_count,
        'added_count',latest.added_count,
        'updated_count',latest.updated_count,
        'skipped_count',latest.skipped_count,
        'error',latest.error_text,
        'stale',coalesce((
          select max(r3.completed_at)
          from runs r3
          where r3.family=f.family and r3.status in ('complete','completed')
        ) < now()-interval '8 days',true)
      ) order by f.family),'[]'::jsonb)
      from families f
      left join lateral (
        select r.*
        from runs r
        where r.family=f.family
        order by r.imported_at desc
        limit 1
      ) latest on true
    ),
    'municipalities',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'source_id',s.id,
        'domain',s.domain,
        'label',r.display_name,
        'calendar_url',s.calendar_url,
        'source_format',r.source_format,
        'automated',v_municipal_cron,
        'last_attempt_at',r.last_attempt_at,
        'last_success_at',coalesce(r.last_read_at,s.retrieved_on::timestamptz),
        'last_status',r.last_status,
        'last_error',r.last_error,
        'last_result',r.last_result,
        'stale',coalesce(coalesce(r.last_read_at,s.retrieved_on::timestamptz)<now()-interval '8 days',true)
      ) order by r.display_name),'[]'::jsonb)
      from meets_private.source_registry r
      join public.sources s on s.id=r.source_id
      where r.source_format='tvp'
    )
  );
end
$$;

-- Edge function runs: the register load continues every minute while it runs and
-- starts again each month; handball and Sigulda are read weekly like the other sources.
select cron.schedule('meets-address-register-load','* * * * *',$cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/load-address-register',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
  where exists (select 1 from meets_private.address_register_load where state='running')
$cron$);
select cron.schedule('meets-address-register-monthly','17 2 3 * *',$cron$select meets_private.address_register_start()$cron$);
select cron.schedule('sync-handball-events','5 1 * * 3',$cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/sync-handball-events',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
$cron$);
select cron.schedule('sync-sigulda-events','20 1 * * 3',$cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/sync-sigulda-events',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
$cron$);

select meets_private.address_register_start();
select meets_private.place_search_enqueue();
