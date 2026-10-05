-- MEETS 2 pre-hardening Cron snapshot
-- Captured 2026-10-05. Uses Vault secret *names* only; no secret values are stored here.
-- Required Vault entries before restore: meets_project_url, meets_publishable_key

select cron.schedule(
  'sync-athletics-events-weekly',
  '0 0 * * 3',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url') || '/functions/v1/sync-athletics-events',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')
    ),
    body := '{"trigger":"cron-weekly"}'::jsonb,
    timeout_milliseconds := 15000
  );$$
);

select cron.schedule(
  'sync-lff-events-weekly',
  '15 0 * * 3',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url') || '/functions/v1/sync-lff-events',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );$$
);

select cron.schedule(
  'sync-estlat-basketball-events',
  '30 0 * * 3',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url') || '/functions/v1/sync-estlat-basketball-events',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );$$
);

select cron.schedule(
  'sync-lbs-basketball-events',
  '45 0 * * 3',
  $$select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url') || '/functions/v1/sync-lbs-basketball-events',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );$$
);
