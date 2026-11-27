-- pg_cron keeps a row for every run and never removes them: since 30 September
-- cron.job_run_details grew to about 380 000 rows (97 MB, the largest table in the
-- database), about 15 000 more a day. Keep one week of history.

delete from cron.job_run_details where end_time < now() - interval '7 days';

select cron.unschedule(jobid) from cron.job where jobname = 'meets-cron-history-cleanup';
select cron.schedule(
  'meets-cron-history-cleanup',
  '41 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
