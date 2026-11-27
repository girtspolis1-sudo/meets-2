-- Floorball import paused: floorball.lv's calendar table is loaded only from /ajax/,
-- which robots.txt disallows (Disallow: /ajax/, /live.php), and no public HTML page
-- (calendar, pairs, teams, youth groups zu8…zu18, mu10…mu16) carries the games. The job
-- is switched off, not removed: turn it back on (active := true) once the union gives
-- permission or a public schedule source. Already imported games stay until they pass.
select cron.alter_job((select jobid from cron.job where jobname = 'sync-floorball-events'), active := false);
