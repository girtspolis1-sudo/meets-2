-- One edge function call per city: reading all four in one call ran out of the
-- function's CPU allowance (Jelgava's list alone is ~15 pages of 300 KB).
select cron.unschedule('sync-city-events') where exists (select 1 from cron.job where jobname='sync-city-events');
select cron.schedule('sync-city-events-'||site, schedule, format($cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/sync-city-events',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := jsonb_build_object('site',%L), timeout_milliseconds := 150000)
$cron$, site))
  from (values ('daugavpils','25 2 * * 3'),('jelgava','35 2 * * 3'),('valmiera','45 2 * * 3'),('cesis','55 2 * * 3')) v(site,schedule);

-- The first Jelgava run stopped at the CPU limit and never closed its run.
update public.import_runs set status='failed',completed_at=now(),
       error_text='WORKER_RESOURCE_LIMIT: the function ran out of CPU; read again with the page limit'
 where source_key like 'city-jelgava-%' and status='loading';
