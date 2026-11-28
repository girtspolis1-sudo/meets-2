-- Sekot komandai (prompt_dizaina_audits_labojumi.md, 9. kārta; plan in the project
-- doc plan_sekot_komandai.md).
--
-- Teams have no table: a team is its name within a sport, as the league imports
-- (event_sports_metadata.home_team / away_team) and the tournaments write it.
-- The key is "sport:name": the sport as event_sports_metadata.sport_format, the
-- name in lower case with dashes and spaces made uniform. lib/team-key.js builds
-- the same key in the API and the browser.
-- Following is kept like the place follows (meets_user_location_follows): own rows
-- only. Nothing is sent to anyone: no notifications, no e-mails.

-- 1. The key.
create or replace function public.meets_team_key(p_name text, p_sport text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
 select case
  when length(btrim(coalesce(p_name, ''))) = 0 or length(btrim(coalesce(p_sport, ''))) = 0 then null
  else lower(btrim(p_sport)) || ':' ||
   btrim(regexp_replace(lower(translate(p_name, E'‐‑‒–—― ', '------ ')), '\s+', ' ', 'g'))
 end
$$;

-- A tournament's sport as event_sports_metadata.sport_format.
create or replace function public.meets_team_sport(p_sport text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
 select case p_sport
  when 'basket3x3' then 'basketball'
  when 'basket5x5' then 'basketball'
  when 'hockey' then 'ice_hockey'
  else p_sport
 end
$$;

-- 2. Finding a team's games by its key.
create index if not exists event_sports_metadata_home_team_key_idx
 on public.event_sports_metadata (public.meets_team_key(home_team, sport_format));
create index if not exists event_sports_metadata_away_team_key_idx
 on public.event_sports_metadata (public.meets_team_key(away_team, sport_format));

-- 3. The follows.
create table if not exists public.meets_user_team_follows (
 user_id uuid not null references auth.users(id) on delete cascade,
 team_key text not null check (length(team_key) between 3 and 200),
 team_name text not null check (length(team_name) between 1 and 120),
 sport text not null check (length(sport) between 1 and 40),
 created_at timestamptz not null default now(),
 primary key (user_id, team_key),
 constraint meets_user_team_follows_key_matches check (team_key = public.meets_team_key(team_name, sport))
);
create index if not exists meets_user_team_follows_team_key_idx
 on public.meets_user_team_follows (team_key);

-- A team can be followed while it plays in a published event or a published tournament.
create or replace function public.meets_team_follow_valid(p_key text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
 select exists(
   select 1 from public.event_sports_metadata m join public.events e on e.id = m.event_id
   where public.meets_team_key(m.home_team, m.sport_format) = p_key and e.status = 'published')
  or exists(
   select 1 from public.event_sports_metadata m join public.events e on e.id = m.event_id
   where public.meets_team_key(m.away_team, m.sport_format) = p_key and e.status = 'published')
  or exists(
   select 1 from public.meets_tournament_teams tt join public.meets_tournaments t on t.id = tt.tournament_id
   where t.status = 'published' and public.meets_team_key(tt.name, public.meets_team_sport(t.sport)) = p_key)
$$;
revoke all on function public.meets_team_follow_valid(text) from public, anon;
grant execute on function public.meets_team_follow_valid(text) to authenticated, service_role;

alter table public.meets_user_team_follows enable row level security;
drop policy if exists meets_user_team_follows_own_select on public.meets_user_team_follows;
create policy meets_user_team_follows_own_select on public.meets_user_team_follows
 for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists meets_user_team_follows_own_insert on public.meets_user_team_follows;
create policy meets_user_team_follows_own_insert on public.meets_user_team_follows
 for insert to authenticated with check (user_id = (select auth.uid()));
-- Restrictive, so it holds together with the own-row rule above (as meets_user_follows_valid).
drop policy if exists meets_user_team_follows_valid on public.meets_user_team_follows;
create policy meets_user_team_follows_valid on public.meets_user_team_follows
 as restrictive for insert to authenticated with check (public.meets_team_follow_valid(team_key));
drop policy if exists meets_user_team_follows_own_delete on public.meets_user_team_follows;
create policy meets_user_team_follows_own_delete on public.meets_user_team_follows
 for delete to authenticated using (user_id = (select auth.uid()));

-- Public event discovery stays anonymous; personal subscriptions do not.
revoke all on public.meets_user_team_follows from anon, public;
grant select, insert, delete on public.meets_user_team_follows to authenticated;

-- 4. The next five coming games of each followed team: [{team_key, event_id}].
-- Only published events; results are not part of the catalogue, so none are returned.
create or replace function public.meets_team_follow_games()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
 with mine as (
  select f.team_key from public.meets_user_team_follows f where f.user_id = (select auth.uid())
 ), games as (
  select mine.team_key, m.event_id from mine
   join public.event_sports_metadata m on public.meets_team_key(m.home_team, m.sport_format) = mine.team_key
  union
  select mine.team_key, m.event_id from mine
   join public.event_sports_metadata m on public.meets_team_key(m.away_team, m.sport_format) = mine.team_key
 ), coming as (
  select g.team_key, e.id as event_id, e.date_from, e.time_from,
   row_number() over (partition by g.team_key order by e.date_from, e.time_from nulls last, e.id) as n
  from games g join public.events e on e.id = g.event_id
  where e.status = 'published' and coalesce(e.date_to, e.date_from) >= (now() at time zone 'Europe/Riga')::date
 )
 select coalesce(jsonb_agg(jsonb_build_object('team_key', c.team_key, 'event_id', c.event_id)
  order by c.date_from, c.time_from nulls last), '[]'::jsonb)
 from coming c where c.n <= 5
$$;
revoke all on function public.meets_team_follow_games() from public, anon;
grant execute on function public.meets_team_follow_games() to authenticated, service_role;

-- 5. The profile's "No sekošanas" list also takes the followed teams' coming games.
create or replace function public.meets_followed_event_ids()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
 select coalesce(jsonb_agg(distinct ids.event_id), '[]'::jsonb) from (
  select s.event_id
  from public.meets_user_follows f join public.meets_submissions s on
  ((f.target_kind = 'organization' and f.target_id = s.organization_id)
   or (f.target_kind = 'venue' and f.target_id = s.venue_id))
  join public.events e on e.id = s.event_id
  where f.user_id = auth.uid() and s.status = 'published' and e.status = 'published'
   and coalesce(e.date_to, e.date_from) >= (now() at time zone 'Europe/Riga')::date
  union
  select e.id
  from public.meets_user_follows f join public.sources src
    on f.target_kind = 'source' and f.target_id = md5('meets-source:' || src.id::text)::uuid
  join public.event_sources es on es.source_id = src.id
  join public.events e on e.id = es.event_id
  where f.user_id = auth.uid() and e.status = 'published'
   and coalesce(e.date_to, e.date_from) >= (now() at time zone 'Europe/Riga')::date
  union
  select (g ->> 'event_id')::uuid from jsonb_array_elements(public.meets_team_follow_games()) g
 ) ids
$$;
