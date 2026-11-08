-- "Veidot pašam": a tournament with its own stages after the groups
-- (settings.stages: final group, knockout or games for places, each taking a
-- run of group places).
alter table public.meets_tournaments
  drop constraint meets_tournaments_format_check,
  add constraint meets_tournaments_format_check check (format in ('round_robin','groups_places','groups_final','groups_knockout','knockout','custom'));
