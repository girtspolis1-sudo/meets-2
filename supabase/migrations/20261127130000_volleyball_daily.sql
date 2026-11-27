-- Volleyball (volejbols.lv): youth games appear in the federation calendar only a few days
-- ahead, so sync-volleyball-events runs every night instead of on Wednesdays only. The
-- function now reads this month and the next two (the calendar page shows the current
-- month only), imports youth competitions with sports_competitions.level='youth' and takes
-- games that left the calendar off the map.
select cron.alter_job(jobid, schedule := '50 1 * * *')
  from cron.job where jobname = 'sync-volleyball-events';
