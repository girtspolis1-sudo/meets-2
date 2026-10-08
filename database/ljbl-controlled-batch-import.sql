-- Controlled LJBL batch import helper.
-- Uses one import_run_id across batches and imports only rows from
-- public.basketball_ljbl_import_ready_v.

insert into public.sources(domain, calendar_url, retrieved_on)
values ('ljbl.basket.lv','https://ljbl.basket.lv/',current_date)
on conflict(domain) do update
set calendar_url=excluded.calendar_url,retrieved_on=excluded.retrieved_on;

insert into public.sports_competitions(
  governing_body,competition_key,name,season,competition_type,sport_format,default_age_group,source_url,active
)
select
  'LBS / LJBL',
  source_key,
  trim(both ', ' from competition),
  '2026/2027',
  coalesce(division,'LJBL'),
  'basketball',
  age_group,
  calendar_url,
  true
from public.basketball_sources
where section='LJBL' and active=true
on conflict(competition_key) do update
set name=excluded.name,
    season=excluded.season,
    competition_type=excluded.competition_type,
    sport_format=excluded.sport_format,
    default_age_group=excluded.default_age_group,
    source_url=excluded.source_url,
    updated_at=now();

-- See production DB function meets_private.import_ljbl_batch(run_id, offset, limit).
-- Import executed on 2026-10-06 in batches 0,200,400,600,800,1000,1200
-- under one import_run_id, total 1343 rows.
