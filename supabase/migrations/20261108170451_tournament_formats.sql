-- Two more tournament formats: groups and a final group (the best of every
-- group play again in one group), and groups and knockout. Final group games
-- have their own stage.
alter table public.meets_tournaments
  drop constraint meets_tournaments_format_check,
  add constraint meets_tournaments_format_check check (format in ('round_robin','groups_places','groups_final','groups_knockout','knockout'));
alter table public.meets_tournament_games
  drop constraint meets_tournament_games_stage_check,
  add constraint meets_tournament_games_stage_check check (stage in ('group','final','placement','knockout'));
