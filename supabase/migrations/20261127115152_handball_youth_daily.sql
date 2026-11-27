-- Handball: the import now also reads the youth calendar (U12–U19, mini handball) and
-- writes at most 200 new or changed games per run, so it runs every night instead of
-- once a week (Wednesday). Results are never imported.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'sync-handball-events'),
  schedule := '15 2 * * *',
  command := $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/sync-handball-events',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 300000)
$cmd$
);
