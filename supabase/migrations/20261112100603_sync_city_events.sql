-- Daugavpils, Jelgava, Valmiera and Cēsis publish their events on their own
-- sites (not the state platform, no .ics feed). Edge function sync-city-events
-- reads them weekly, on Wednesday night with the other imports.
select cron.schedule('sync-city-events','25 2 * * 3',$cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/sync-city-events',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
$cron$);
