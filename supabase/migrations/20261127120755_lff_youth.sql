-- LFF youth football and futsal (sync-lff-youth-events): every Monday, Wednesday and
-- Friday (about 60 competition pages per run, so not every night), and its own family in
-- the import health check so its runs are not mixed with the adult LFF import.
select cron.schedule('sync-lff-youth-events', '25 3 * * 1,3,5', $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/sync-lff-youth-events',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 300000)
$cmd$);

CREATE OR REPLACE FUNCTION meets_private.import_problems()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with runs as (
    select case
             when source_commit like 'ljbl-%' then 'Basketbols (LJBL)'
             when source_key like 'athletics-lv-%' then 'Vieglatlētika'
             when source_key like 'lff-youth-%' then 'Futbols (LFF jaunatne)'
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
      from (values ('Vieglatlētika'),('Futbols (LFF)'),('Futbols (LFF jaunatne)'),('Latvijas–Igaunijas basketbola līga'),('Basketbols (LBS)'),('Basketbols (LJBL)'),('Handbols'),
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
