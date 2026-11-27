-- Latvian Youth Basketball League (LJBL): switch the 36 age-group calendars on.
-- Their games are youth competitions (sports_competitions.level='youth', set in
-- 20261127093420_sport_level), so the public site shows them only under
-- "Sacensību līmenis: Jaunieši" or "Visi"; the default view stays adult-only.
-- Applied only after the dry-run report was approved (2026-11-27: 603 games in the next
-- 90 days, 456 in 30 days, all with a hall name; 599 of them in a hall the place search
-- already knows).

-- 1. The weekly sync-lbs-basketball-events run reads active LJBL sources.
update public.basketball_sources
   set active = true, updated_at = now()
 where section = 'LJBL' and parser_type = 'sportradar' and website_id is not null and active = false;

-- 2. The catalogue shows games of active competitions only.
update public.sports_competitions
   set active = true, level = coalesce(level, 'youth'), updated_at = now()
 where competition_key like 'ljbl:%' and active = false;

-- 3. LJBL times change often: refresh the youth league every morning as well.
select cron.unschedule(jobid) from cron.job where jobname = 'sync-ljbl-basketball-daily';
select cron.schedule('sync-ljbl-basketball-daily', '40 4 * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url') || '/functions/v1/sync-lbs-basketball-events',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')
    ),
    body := '{"only":"ljbl"}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);

-- 4. Import health: LJBL runs (source_commit 'ljbl-…') are their own line in the admin centre.
create or replace function meets_private.import_problems()
 returns text[]
 language sql
 stable security definer
 set search_path to ''
as $function$
  with runs as (
    select case
             when source_commit like 'ljbl-%' then 'Basketbols (LJBL)'
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
      from (values ('Vieglatlētika'),('Futbols (LFF)'),('Latvijas–Igaunijas basketbola līga'),('Basketbols (LBS)'),('Basketbols (LJBL)'),('Handbols'),
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

-- 5. First run right away, so the games from the one-off October import are refreshed
--    (72 moved, 22 no longer listed) within a minute of switching on.
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url') || '/functions/v1/sync-lbs-basketball-events',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')
  ),
  body := '{"only":"ljbl"}'::jsonb,
  timeout_milliseconds := 120000
);
