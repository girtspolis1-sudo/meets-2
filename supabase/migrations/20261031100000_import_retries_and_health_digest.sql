-- Municipality calendar pages that time out are requested again (up to 3 times,
-- with a longer timeout) before the whole source falls back to its previous copy.
-- Import problems from the last day are added to the admin's daily digest.

alter table meets_private.municipality_refresh_pages
  add column if not exists attempts integer not null default 1;

create or replace function meets_private.municipality_sync_tick(p_max_pages integer default 24)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_run uuid; v_job record; v_source record; n_pages integer:=0; n_retried integer:=0;
 v_accept integer;v_fallback integer;v_added integer;v_running integer;v_sources integer;
begin
 if not pg_try_advisory_xact_lock(201026,1126) then return jsonb_build_object('state','busy');end if;
 select id into v_run from meets_private.municipality_sync_runs
 where state='running' order by started_at limit 1 for update;
 if v_run is null then return jsonb_build_object('state','idle');end if;
 -- Pages that failed or got no answer in 30 minutes are asked for again.
 for v_job in
  select j.id,j.page,s.domain from meets_private.municipality_refresh_pages j
  join public.sources s on s.id=j.source_id
  left join net._http_response r on r.id=j.request_id
  where j.batch_id=v_run and j.status='queued' and j.attempts<3 and (
   (r.id is not null and (r.status_code is distinct from 200 or r.content is null
     or position('notikumu-kalendars' in r.content)=0))
   or (r.id is null and j.queued_at<now()-interval '30 minutes'))
 loop
   update meets_private.municipality_refresh_pages
      set request_id=net.http_get(url:='https://www.'||v_job.domain||'/lv/notikumu-kalendars?page='||v_job.page::text,
                                  timeout_milliseconds:=30000),
          attempts=attempts+1,queued_at=now()
    where id=v_job.id;
   n_retried:=n_retried+1;
 end loop;
 for v_job in
 select j.id from meets_private.municipality_refresh_pages j
 left join net._http_response r on r.id=j.request_id
 where j.batch_id=v_run and j.status='queued' and
 (r.id is not null or j.queued_at < now()-interval '3 hours')
 order by j.id limit greatest(1,least(coalesce(p_max_pages,24),60))
 loop
   perform meets_private.municipality_sync_collect_page(v_job.id);
   n_pages:=n_pages+1;
 end loop;
 for v_source in
  select sr.source_id from meets_private.municipality_sync_source_runs sr
  where sr.run_id=v_run and sr.state='running' and not exists
   (select 1 from meets_private.municipality_refresh_pages j
    where j.batch_id=v_run and j.source_id=sr.source_id and j.status='queued')
  order by sr.source_id
 loop
   begin
    perform meets_private.municipality_sync_finalize_source(v_run,v_source.source_id);
   exception when others then
    update meets_private.municipality_sync_source_runs set state='fallback',finished_at=now(),
     detail=left('Importa kļūda: '||sqlerrm,500)
    where run_id=v_run and source_id=v_source.source_id;
    update meets_private.source_registry set last_attempt_at=now(),last_status='partial',
     last_error=left('Importa kļūda: '||sqlerrm,500)
    where source_id=v_source.source_id;
   end;
 end loop;
 select count(*) filter(where state='accepted'),count(*) filter(where state='fallback'),
 sum(added_count),count(*) filter(where state='running'),count(*)
 into v_accept,v_fallback,v_added,v_running,v_sources
 from meets_private.municipality_sync_source_runs where run_id=v_run;
 if v_running=0 then
  update meets_private.municipality_sync_runs set
   state=case when v_accept=0 then 'failed' when v_fallback>0 then 'partial' else 'completed' end,
   finished_at=now(),accepted_count=v_accept,fallback_count=v_fallback,added_count=coalesce(v_added,0),
   message=case when v_fallback>0 then v_fallback||' avotos saglabāta iepriekšējā kopija' else 'Visi avoti validēti' end
  where id=v_run;
  update public.import_runs set status=case when v_accept=0 then 'failed' else 'completed' end,
   expected_count=v_sources,imported_count=coalesce(v_added,0),added_count=coalesce(v_added,0),
   completed_at=now() where id=v_run;
 end if;
 return jsonb_build_object('run_id',v_run,'processed_pages',n_pages,'retried_pages',n_retried,
 'accepted',v_accept,'fallback',v_fallback,'running',v_running,'added',coalesce(v_added,0),
 'state',case when v_running>0 then 'running' when v_accept=0 then 'failed'
   when v_fallback>0 then 'partial' else 'completed' end);
end $$;

-- Problems an admin should hear about: sports imports that failed in the last day
-- or have not succeeded in 8 days, municipality calendars that fell back in the last day.
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
           end family,*
      from public.import_runs
  ), families as (
    select f.family,
           max(r.completed_at) filter (where r.status in ('complete','completed')) last_success,
           (array_agg(r.status order by r.imported_at desc))[1] last_status,
           (array_agg(r.error_text order by r.imported_at desc))[1] last_error,
           max(r.imported_at) last_attempt
      from (values ('Vieglatlētika'),('Futbols (LFF)'),('Latvijas–Igaunijas basketbola līga'),('Basketbols (LBS)')) f(family)
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

create or replace function meets_private.send_admin_digest()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin text; v_sent int:=0; v_pending int; v_oldest int; v_held int; v_auto int; v_noplace int; v_list text;
  v_problems text[]; v_places int; v_place_events int; v_text text;
  v_today date:=(now() at time zone 'Europe/Riga')::date;
begin
  select count(*),coalesce(max(v_today-(coalesce(submitted_at,created_at) at time zone 'Europe/Riga')::date),0)
    into v_pending,v_oldest from public.meets_submissions where status='pending_review';
  select string_agg('• '||title||' ('||to_char(date_from,'DD.MM.')||', '||coalesce(nullif(venue_name,''),'vieta nav norādīta')||')',E'\n' order by coalesce(submitted_at,created_at))
    into v_list from (select * from public.meets_submissions where status='pending_review' order by coalesce(submitted_at,created_at) limit 10) p;
  select count(*) into v_noplace from public.events e left join public.event_locations l on l.event_id=e.id
   where e.status='pending_review' and e.date_from between v_today and v_today+7 and coalesce(l.location_quality,'')<>'verified_exact';
  v_problems := meets_private.import_problems();
  -- Places with an address suggestion waiting for approval in Admin → Mapping.
  select count(*),coalesce(sum(event_count),0) into v_places,v_place_events
    from meets_private.place_search_queue q
   where q.state='done' and q.result_count>0
     and exists (select 1 from public.event_locations l where l.venue_name=q.venue_name and l.verified_at is null);
  v_text := concat_ws(E'\n\n',
    case when v_list is not null then 'Gaida pārbaudi:'||E'\n'||v_list end,
    case when cardinality(v_problems)>0 then 'Importu problēmas:'||E'\n• '||array_to_string(v_problems,E'\n• ') end);
  for v_admin in select email from meets_private.admin_email_allowlist loop
    select count(*) filter(where kind<>'admin_auto_published'),count(*) filter(where kind='admin_auto_published')
      into v_held,v_auto from meets_private.email_outbox where to_email=v_admin and status='held';
    if v_pending=0 and v_held=0 and v_auto=0 and cardinality(v_problems)=0 then continue; end if;
    perform meets_private.queue_email('admin_digest',null,v_admin,
      'MEETS kopsavilkums: '||v_pending||' gaida pārbaudi'||case when cardinality(v_problems)>0 then ', '||cardinality(v_problems)||' importu problēmas' else '' end,
      'Kopsavilkums '||to_char(v_today,'DD.MM.YYYY'),
      jsonb_build_array(
        jsonb_build_array('Gaida pārbaudi',v_pending::text||case when v_pending>0 then ' (vecākais '||v_oldest||' d.)' else '' end),
        jsonb_build_array('Jauni vai laboti kopš pēdējās ziņas',nullif(v_held,0)::text),
        jsonb_build_array('Automātiski publicēti',nullif(v_auto,0)::text),
        jsonb_build_array('Tuvāko 7 dienu pasākumi bez vietas',nullif(v_noplace,0)::text),
        jsonb_build_array('Vietas ar adreses ieteikumu',case when v_places>0 then v_places||' ('||v_place_events||' pasākumi)' end),
        jsonb_build_array('Importu problēmas',nullif(cardinality(v_problems),0)::text)),
      nullif(v_text,''),
      'Atvērt admin vidi',meets_private.setting('site_url')||'/admin');
    update meets_private.email_outbox set status='digested' where to_email=v_admin and status='held';
    v_sent:=v_sent+1;
  end loop;
  return v_sent;
end $$;

-- Municipality calendars are automated (weekly cron) since 2026-10.
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
            else null
          end as family,
          *
        from public.import_runs
      ),
      families as (
        select unnest(array['athletics','lff','estlat','lbs']) as family
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'key',f.family,
        'label',case f.family
          when 'athletics' then 'Athletics.lv'
          when 'lff' then 'LFF'
          when 'estlat' then 'Latvijas–Igaunijas basketbola līga'
          when 'lbs' then 'Basket.lv / LBS'
        end,
        'cron_active',coalesce((
          select j.active from cron.job j
          where j.jobname=case f.family
            when 'athletics' then 'sync-athletics-events-weekly'
            when 'lff' then 'sync-lff-events-weekly'
            when 'estlat' then 'sync-estlat-basketball-events'
            when 'lbs' then 'sync-lbs-basketball-events'
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
