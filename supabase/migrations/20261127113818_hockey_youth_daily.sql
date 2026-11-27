-- Hockey (lhf.lv): sync-hockey-events now also reads the children's and youth
-- championship (Latvijas Bērnu un Jaunatnes čempionāts hokejā, U8–U18; competitions with
-- sports_competitions.level='youth'). Most youth games are listed without a start time
-- ("TP") until a few days ahead, so the import runs every night instead of on Wednesdays.
select cron.alter_job(jobid, schedule := '35 1 * * *')
  from cron.job where jobname = 'sync-hockey-events';
