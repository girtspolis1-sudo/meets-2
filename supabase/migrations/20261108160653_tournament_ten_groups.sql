-- Tournaments with up to ten groups (A–J) and group places past 9 (A10, A11 ...).
alter table public.meets_tournament_teams
  drop constraint meets_tournament_teams_group_key_check,
  add constraint meets_tournament_teams_group_key_check check (group_key ~ '^[A-J]?$');
alter table public.meets_tournament_games
  drop constraint meets_tournament_games_group_key_check,
  add constraint meets_tournament_games_group_key_check check (group_key ~ '^[A-J]?$'),
  drop constraint meets_tournament_games_home_ref_check,
  add constraint meets_tournament_games_home_ref_check check (home_ref ~ '^(T:[a-z0-9-]{1,20}|[A-J][1-9][0-9]?|[WL]:[0-9]{1,3})$'),
  drop constraint meets_tournament_games_away_ref_check,
  add constraint meets_tournament_games_away_ref_check check (away_ref ~ '^(T:[a-z0-9-]{1,20}|[A-J][1-9][0-9]?|[WL]:[0-9]{1,3})$');
