-- Hockey (lhf.lv), volleyball (volejbols.lv) and floorball (floorball.lv) imports:
-- sources, categories, weekly cron jobs and the import-health families.

-- 1) Sources and categories.
insert into public.sources (domain, calendar_url, municipality_id, retrieved_on, map_visible)
select v.domain, v.url, null, null, true
  from (values
    ('lhf.lv','https://www.lhf.lv/lv/turniri/optibet-hokeja-liga/speles'),
    ('volejbols.lv','https://volejbols.lv/kalendars/'),
    ('floorball.lv','https://www.floorball.lv/lv/2026/chempionats/vv/kalendars')
  ) v(domain,url)
 where not exists (select 1 from public.sources s where s.domain = v.domain);

insert into public.categories (name)
select v.name
  from (values ('Hokejs'),('Volejbols'),('Florbols')) v(name)
 where not exists (select 1 from public.categories c where c.name = v.name);

-- 2) Weekly runs, Wednesday night like the other sports imports.
select cron.schedule(j.name, j.schedule, format($cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/%s',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
$cron$, j.name))
  from (values
    ('sync-hockey-events','35 1 * * 3'),
    ('sync-volleyball-events','50 1 * * 3'),
    ('sync-floorball-events','5 2 * * 3')
  ) j(name, schedule);

-- 3) Import health: the admin panel and the daily digest list every sports family.
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
    select 'Kalendāra saite “'||f.label||'”: '||coalesce(f.last_error,'ielāde neizdevās')
      from meets_private.calendar_feeds f
     where f.active and f.last_status='failed' and f.last_run_at>now()-interval '1 day'
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
            when source_key like 'hockey-%' then 'hockey'
            when source_key like 'volleyball-%' then 'volleyball'
            when source_key like 'floorball-%' then 'floorball'
            when source_key like 'sigulda-%' then 'sigulda'
            else null
          end as family,
          *
        from public.import_runs
      ),
      families as (
        select f.family, f.label, f.job
          from (values
            ('athletics','Athletics.lv','sync-athletics-events-weekly'),
            ('lff','LFF','sync-lff-events-weekly'),
            ('estlat','Latvijas–Igaunijas basketbola līga','sync-estlat-basketball-events'),
            ('lbs','Basket.lv / LBS','sync-lbs-basketball-events'),
            ('handball','Handball.lv','sync-handball-events'),
            ('hockey','LHF (hokejs)','sync-hockey-events'),
            ('volleyball','Volejbols.lv','sync-volleyball-events'),
            ('floorball','Floorball.lv','sync-floorball-events'),
            ('sigulda','Siguldas novads (sigulda.lv)','sync-sigulda-events')
          ) f(family,label,job)
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'key',f.family,
        'label',f.label,
        'cron_active',coalesce((select j.active from cron.job j where j.jobname=f.job limit 1),false),
        'schedule',(select j.schedule from cron.job j where j.jobname=f.job limit 1),
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

-- 4) LFF futsal competitions read by sync-lff-events (it requires a row per key).
insert into public.sports_competitions (governing_body, competition_key, name, season, competition_type, sport_format, source_url, active)
values
  ('LFF','lff-futsal-virsliga','Telpu futbola virslīga','2026/2027','league','futsal','https://lff.lv/sacensibas/telpu-futbols/virsliga/',true),
  ('LFF','lff-futsal-1-liga','Telpu futbola 1. līga','2026/2027','league','futsal','https://lff.lv/sacensibas/telpu-futbols/1-liga/',true),
  ('LFF','lff-futsal-kauss','Latvijas kauss telpu futbolā','2026/2027','cup','futsal','https://lff.lv/sacensibas/telpu-futbols/kausa-izcinas/',true),
  ('LFF','lff-futsal-sievietes','Sieviešu telpu futbola līga','2026/2027','league','futsal','https://lff.lv/sacensibas/sievietes/sieviesu-telpu-futbola-liga/',true)
on conflict (competition_key) do nothing;

-- 5) Regional basketball tournaments (regionalie.basket.lv), read by sync-lbs-basketball-events.
insert into public.sources (domain, calendar_url, map_visible)
select 'regionalie.basket.lv','https://regionalie.basket.lv/',true
 where not exists (select 1 from public.sources where domain='regionalie.basket.lv');

-- 6) Regional Sportradar feeds give a venue id but no venue name; the national feeds name
--    the same halls. Look the name up from games already imported with that venue id,
--    preferring a location an admin has verified.
create or replace function public.meets_sportradar_venue_names(p_venue_ids text[])
returns table(source_venue_id text, venue_name text)
language sql
stable
security definer
set search_path to ''
as $$
  select distinct on (m.source_venue_id) m.source_venue_id, l.venue_name
    from public.event_sports_metadata m
    join public.event_locations l on l.event_id=m.event_id
   where m.source_venue_id = any(p_venue_ids)
     and nullif(trim(l.venue_name),'') is not null
   order by m.source_venue_id, (l.location_quality='verified_exact') desc, l.verified_at desc nulls last
$$;
revoke all on function public.meets_sportradar_venue_names(text[]) from public, anon, authenticated;
grant execute on function public.meets_sportradar_venue_names(text[]) to service_role;
