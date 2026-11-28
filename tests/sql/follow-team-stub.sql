-- A minimal copy of the production objects that following a team builds on, so
-- the rules can be tested in an empty Postgres:
--   psql -d scratch -f tests/sql/follow-team-stub.sql
--   psql -d scratch -f supabase/migrations/20261128191206_follow_team.sql
--   psql -d scratch -f tests/sql/follow-team.test.sql
do $$ begin
 if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
 if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
 if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);
-- Supabase reads the signed-in user from the request; here a setting stands in for it.
create or replace function auth.uid() returns uuid language sql stable
 as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

create table if not exists public.events(id uuid primary key, title text, date_from date, date_to date, time_from time, status text);
create table if not exists public.event_sports_metadata(event_id uuid, competition_id bigint, age_group text, sport_format text, home_team text, away_team text);
create table if not exists public.meets_tournaments(id uuid primary key, sport text, status text);
create table if not exists public.meets_tournament_teams(tournament_id uuid, key text, name text);
create table if not exists public.meets_user_follows(user_id uuid, target_kind text, target_id uuid);
create table if not exists public.meets_submissions(event_id uuid, organization_id uuid, venue_id uuid, status text);
create table if not exists public.sources(id uuid primary key);
create table if not exists public.event_sources(event_id uuid, source_id uuid);
