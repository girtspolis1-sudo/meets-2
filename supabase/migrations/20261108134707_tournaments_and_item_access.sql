-- 1. Who may do what in an organizer (rīkotājs):
--      owner, admin            everything; they also invite people
--      editor  ("Rīkotājs")    creates and manages events and tournaments
--      contributor ("Labotājs") edits existing events and tournaments, creates nothing
--      viewer                  reads
--    One event or one tournament can also be given to a person to edit
--    (meets_item_access), through an invitation link for that item.
-- 2. Sports tournaments: teams in groups, games on courts with times and results.
--   * The organizer's team reads and edits through RLS (meets_org_can_read /
--     meets_org_can_edit), saving the whole plan with meets_tournament_save.
--   * Everyone else sees a published tournament only through its link:
--     meets_shared_tournament(token). Youth tournaments hide results there.
--   * A court secretary enters results through a court link:
--     meets_scorer_tournament / meets_scorer_set_score.
-- Team references in games: T:<key>, A1 (group A winner), W:<no>, L:<no>.

-- ---------------------------------------------------------------- access
alter table public.meets_organization_members
  drop constraint meets_organization_members_role_check,
  add constraint meets_organization_members_role_check check (role in ('owner','admin','editor','contributor','viewer'));
alter table public.meets_organization_invitations
  drop constraint meets_organization_invitations_role_check,
  add constraint meets_organization_invitations_role_check check (role in ('admin','editor','contributor','viewer')),
  add column item_kind text check (item_kind in ('event','tournament')),
  add column item_id uuid,
  add constraint meets_organization_invitations_item check ((item_kind is null) = (item_id is null) and (item_kind is null or role = 'contributor'));

create table public.meets_item_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.meets_organizations(id) on delete cascade,
  item_kind text not null check (item_kind in ('event','tournament')),
  item_id uuid not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, item_kind, item_id)
);
create index meets_item_access_org_idx on public.meets_item_access(organization_id);
alter table public.meets_item_access enable row level security;

-- Owner or admin: manages the team and invitations.
create or replace function public.meets_org_can_manage(p_org uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select auth.uid() is not null and (
    exists(select 1 from public.meets_organizations o where o.id = p_org and o.owner_id = auth.uid())
    or exists(select 1 from public.meets_organization_members m where m.organization_id = p_org and m.user_id = auth.uid() and m.role in ('owner','admin')))
$$;
revoke all on function public.meets_org_can_manage(uuid) from public;
grant execute on function public.meets_org_can_manage(uuid) to authenticated;

create policy "item access read" on public.meets_item_access for select to authenticated
  using (user_id = (select auth.uid()) or public.meets_org_can_manage(organization_id));
create policy "item access remove" on public.meets_item_access for delete to authenticated
  using (public.meets_org_can_manage(organization_id));

-- ---------------------------------------------------------------- tournaments
create table public.meets_tournaments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.meets_organizations(id) on delete cascade,
  submission_id uuid references public.meets_submissions(id) on delete set null,
  title text not null check (length(btrim(title)) between 3 and 160),
  sport text not null check (sport in ('basket3x3','basket5x5','football','floorball','volleyball','hockey','handball','other')),
  format text not null check (format in ('groups_places','round_robin','knockout')),
  play_date date,
  venue text not null default '' check (length(venue) <= 200),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  youth boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published')),
  share_token uuid not null default gen_random_uuid() unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meets_tournaments_organization_idx on public.meets_tournaments(organization_id);

create table public.meets_tournament_teams (
  tournament_id uuid not null references public.meets_tournaments(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9-]{1,20}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  coach text not null default '' check (length(coach) <= 120),
  group_key text not null default '' check (group_key ~ '^[A-H]?$'),
  seed int not null default 0,
  primary key (tournament_id, key)
);

create table public.meets_tournament_games (
  tournament_id uuid not null references public.meets_tournaments(id) on delete cascade,
  no int not null check (no between 1 and 400),
  stage text not null check (stage in ('group','placement','knockout')),
  group_key text not null default '' check (group_key ~ '^[A-H]?$'),
  round int not null default 1 check (round between 1 and 20),
  court text not null default '' check (length(court) <= 40),
  starts_at time,
  home_ref text not null check (home_ref ~ '^(T:[a-z0-9-]{1,20}|[A-H][1-9]|[WL]:[0-9]{1,3})$'),
  away_ref text not null check (away_ref ~ '^(T:[a-z0-9-]{1,20}|[A-H][1-9]|[WL]:[0-9]{1,3})$'),
  label text not null default '' check (length(label) <= 60),
  place int check (place between 1 and 64),
  home_score int check (home_score between 0 and 999),
  away_score int check (away_score between 0 and 999),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, no),
  check ((home_score is null) = (away_score is null))
);

-- One link per court ('*' = every court) for entering results.
create table public.meets_tournament_scorers (
  tournament_id uuid not null references public.meets_tournaments(id) on delete cascade,
  court text not null check (length(court) between 1 and 40),
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  primary key (tournament_id, court)
);

alter table public.meets_tournaments enable row level security;
alter table public.meets_tournament_teams enable row level security;
alter table public.meets_tournament_games enable row level security;
alter table public.meets_tournament_scorers enable row level security;

-- The organizer a tournament belongs to, for the policies of its rows.
create or replace function public.meets_tournament_org(p_tournament uuid)
returns uuid language sql stable security definer set search_path to '' as $$
  select organization_id from public.meets_tournaments where id = p_tournament
$$;
revoke all on function public.meets_tournament_org(uuid) from public;
grant execute on function public.meets_tournament_org(uuid) to authenticated;

-- May the signed-in user edit this event or tournament: an editor of the
-- organizer, a contributor of it, or a person given this one item.
create or replace function public.meets_can_edit_item(p_kind text, p_item uuid, p_org uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select auth.uid() is not null and (
    public.meets_org_can_edit(p_org)
    or exists(select 1 from public.meets_organization_members m where m.organization_id = p_org and m.user_id = auth.uid() and m.role = 'contributor')
    or exists(select 1 from public.meets_item_access a where a.user_id = auth.uid() and a.item_kind = p_kind and a.item_id = p_item and a.organization_id = p_org))
$$;
revoke all on function public.meets_can_edit_item(text, uuid, uuid) from public;
grant execute on function public.meets_can_edit_item(text, uuid, uuid) to authenticated;

-- Events: contributors and people given one event read and edit it (not create).
create policy "submissions read by item access" on public.meets_submissions for select to authenticated
  using (public.meets_can_edit_item('event', id, organization_id));
create policy "submissions update by item access" on public.meets_submissions for update to authenticated
  using (status = any (array['draft','rejected','private']) and public.meets_can_edit_item('event', id, organization_id))
  with check (status = any (array['draft','pending_review','private']) and event_id is null and public.meets_can_edit_item('event', id, organization_id));

create policy "tournaments read" on public.meets_tournaments for select to authenticated
  using (public.meets_org_can_read(organization_id) or public.meets_can_edit_item('tournament', id, organization_id));
create policy "tournaments insert by editors" on public.meets_tournaments for insert to authenticated
  with check (public.meets_org_can_edit(organization_id));
create policy "tournaments update" on public.meets_tournaments for update to authenticated
  using (public.meets_can_edit_item('tournament', id, organization_id)) with check (public.meets_can_edit_item('tournament', id, organization_id));
create policy "tournaments delete by editors" on public.meets_tournaments for delete to authenticated
  using (public.meets_org_can_edit(organization_id));

create policy "tournament teams read" on public.meets_tournament_teams for select to authenticated
  using (public.meets_org_can_read(public.meets_tournament_org(tournament_id)) or public.meets_can_edit_item('tournament', tournament_id, public.meets_tournament_org(tournament_id)));
create policy "tournament teams edit" on public.meets_tournament_teams for all to authenticated
  using (public.meets_can_edit_item('tournament', tournament_id, public.meets_tournament_org(tournament_id)))
  with check (public.meets_can_edit_item('tournament', tournament_id, public.meets_tournament_org(tournament_id)));
create policy "tournament games read" on public.meets_tournament_games for select to authenticated
  using (public.meets_org_can_read(public.meets_tournament_org(tournament_id)) or public.meets_can_edit_item('tournament', tournament_id, public.meets_tournament_org(tournament_id)));
create policy "tournament games edit" on public.meets_tournament_games for all to authenticated
  using (public.meets_can_edit_item('tournament', tournament_id, public.meets_tournament_org(tournament_id)))
  with check (public.meets_can_edit_item('tournament', tournament_id, public.meets_tournament_org(tournament_id)));
create policy "tournament scorers" on public.meets_tournament_scorers for all to authenticated
  using (public.meets_can_edit_item('tournament', tournament_id, public.meets_tournament_org(tournament_id)))
  with check (public.meets_can_edit_item('tournament', tournament_id, public.meets_tournament_org(tournament_id)));

-- Saves a tournament, its teams and its games in one step (as the signed-in
-- user, so RLS applies). Entered results are kept for games whose number and
-- teams did not change; a changed pairing starts without a result.
create or replace function public.meets_tournament_save(p_tournament jsonb, p_teams jsonb, p_games jsonb)
returns uuid language plpgsql security invoker set search_path to '' as $$
declare
  v_id uuid := nullif(p_tournament->>'id','')::uuid;
  v_org uuid := (p_tournament->>'organization_id')::uuid;
  v_old jsonb;
  v_event uuid;
begin
  -- Only an event of the same organizer can be linked (its link is shown with the tournament).
  select s.id into v_event from public.meets_submissions s
  where s.id = nullif(p_tournament->>'submission_id','')::uuid and s.organization_id = v_org;
  if v_id is null and not public.meets_org_can_edit(v_org) then
    raise exception 'Nav tiesību veidot šī rīkotāja turnīrus' using errcode = '42501';
  end if;
  if v_id is not null and not public.meets_can_edit_item('tournament', v_id, v_org) then
    raise exception 'Nav tiesību labot šo turnīru' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.meets_tournaments(organization_id, submission_id, title, sport, format, play_date, venue, settings, youth, status)
    values (v_org, v_event, btrim(p_tournament->>'title'), p_tournament->>'sport',
      p_tournament->>'format', nullif(p_tournament->>'play_date','')::date, coalesce(p_tournament->>'venue',''),
      coalesce(p_tournament->'settings','{}'::jsonb), coalesce((p_tournament->>'youth')::boolean,false), coalesce(p_tournament->>'status','draft'))
    returning id into v_id;
  else
    update public.meets_tournaments set
      submission_id = v_event, title = btrim(p_tournament->>'title'),
      sport = p_tournament->>'sport', format = p_tournament->>'format', play_date = nullif(p_tournament->>'play_date','')::date,
      venue = coalesce(p_tournament->>'venue',''), settings = coalesce(p_tournament->'settings','{}'::jsonb),
      youth = coalesce((p_tournament->>'youth')::boolean,false), status = coalesce(p_tournament->>'status','draft'), updated_at = now()
    where id = v_id and organization_id = v_org;
    if not found then raise exception 'Turnīrs nav atrasts' using errcode = 'P0002'; end if;
  end if;

  select coalesce(jsonb_object_agg(no::text, jsonb_build_object('h',home_ref,'a',away_ref,'hs',home_score,'as',away_score,'d',details)),'{}'::jsonb)
    into v_old from public.meets_tournament_games where tournament_id = v_id;
  delete from public.meets_tournament_games where tournament_id = v_id;
  delete from public.meets_tournament_teams where tournament_id = v_id;

  insert into public.meets_tournament_teams(tournament_id, key, name, coach, group_key, seed)
  select v_id, t->>'key', btrim(t->>'name'), coalesce(t->>'coach',''), coalesce(t->>'group',''), coalesce((t->>'seed')::int,0)
  from jsonb_array_elements(coalesce(p_teams,'[]'::jsonb)) t;

  insert into public.meets_tournament_games(tournament_id, no, stage, group_key, round, court, starts_at, home_ref, away_ref, label, place, home_score, away_score, details)
  select v_id, (g->>'no')::int, g->>'stage', coalesce(g->>'group',''), coalesce((g->>'round')::int,1), coalesce(g->>'court',''),
    nullif(g->>'starts_at','')::time, g->>'home', g->>'away', coalesce(g->>'label',''), nullif(g->>'place','')::int,
    case when same then (old->>'hs')::int end, case when same then (old->>'as')::int end,
    case when same then coalesce(old->'d','{}'::jsonb) else '{}'::jsonb end
  from (
    select g, v_old->(g->>'no') as old, (v_old->(g->>'no')->>'h') = g->>'home' and (v_old->(g->>'no')->>'a') = g->>'away' as same
    from jsonb_array_elements(coalesce(p_games,'[]'::jsonb)) g
  ) x;
  return v_id;
end $$;
revoke all on function public.meets_tournament_save(jsonb, jsonb, jsonb) from public;
grant execute on function public.meets_tournament_save(jsonb, jsonb, jsonb) to authenticated;

-- Only "papildlaikā" (ot) and the winner of a drawn deciding game are kept.
create or replace function public.meets_tournament_details(p jsonb)
returns jsonb language sql immutable set search_path to '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'ot', case when (p->>'ot') = 'true' then true end,
    'winner', case when p->>'winner' in ('home','away') then p->>'winner' end))
$$;

-- A result entered by the organizer's team.
create or replace function public.meets_tournament_set_score(p_tournament uuid, p_no int, p_home int, p_away int, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security invoker set search_path to '' as $$
begin
  if (p_home is null) <> (p_away is null) then raise exception 'Ievadi abu komandu rezultātu' using errcode = '22023'; end if;
  update public.meets_tournament_games
    set home_score = p_home, away_score = p_away, details = public.meets_tournament_details(coalesce(p_details,'{}'::jsonb)), updated_at = now()
  where tournament_id = p_tournament and no = p_no;
  if not found then raise exception 'Spēle nav atrasta' using errcode = 'P0002'; end if;
  update public.meets_tournaments set updated_at = now() where id = p_tournament;
end $$;
revoke all on function public.meets_tournament_set_score(uuid, int, int, int, jsonb) from public;
grant execute on function public.meets_tournament_set_score(uuid, int, int, int, jsonb) to authenticated;

-- The results link of a court; p_renew replaces it (the old link stops working).
create or replace function public.meets_tournament_scorer_link(p_tournament uuid, p_court text, p_renew boolean default false)
returns uuid language plpgsql security invoker set search_path to '' as $$
declare v_token uuid;
begin
  insert into public.meets_tournament_scorers(tournament_id, court) values (p_tournament, p_court)
  on conflict (tournament_id, court) do update set
    token = case when p_renew then gen_random_uuid() else public.meets_tournament_scorers.token end
  returning token into v_token;
  return v_token;
end $$;
revoke all on function public.meets_tournament_scorer_link(uuid, text, boolean) from public;
grant execute on function public.meets_tournament_scorer_link(uuid, text, boolean) to authenticated;

-- A published tournament by its link. Coaches are not shown; a youth
-- tournament shows the schedule without results.
create or replace function public.meets_shared_tournament(p_token uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'title', t.title, 'sport', t.sport, 'format', t.format, 'play_date', t.play_date, 'venue', t.venue,
    'settings', t.settings, 'youth', t.youth, 'updated_at', t.updated_at,
    'organization', jsonb_build_object('name', o.name, 'id', case when o.is_public then o.id end, 'slug', case when o.is_public then o.slug end),
    'event_token', case when s.status in ('private','pending_review','published') then s.share_token end,
    'teams', coalesce((select jsonb_agg(jsonb_build_object('key', m.key, 'name', m.name, 'group', m.group_key, 'seed', m.seed) order by m.group_key, m.seed)
      from public.meets_tournament_teams m where m.tournament_id = t.id), '[]'::jsonb),
    'games', coalesce((select jsonb_agg(jsonb_build_object('no', g.no, 'stage', g.stage, 'group', g.group_key, 'round', g.round, 'court', g.court,
        'starts_at', to_char(g.starts_at,'HH24:MI'), 'home', g.home_ref, 'away', g.away_ref, 'label', g.label, 'place', g.place,
        'home_score', case when t.youth then null else g.home_score end, 'away_score', case when t.youth then null else g.away_score end,
        'details', case when t.youth then '{}'::jsonb else g.details end) order by g.no)
      from public.meets_tournament_games g where g.tournament_id = t.id), '[]'::jsonb))
  from public.meets_tournaments t
  join public.meets_organizations o on o.id = t.organization_id
  left join public.meets_submissions s on s.id = t.submission_id
  where t.share_token = p_token and t.status = 'published'
$$;
revoke all on function public.meets_shared_tournament(uuid) from public;
grant execute on function public.meets_shared_tournament(uuid) to anon, authenticated;

-- What a court secretary sees: the whole tournament with results, and the court.
create or replace function public.meets_scorer_tournament(p_token uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'court', sc.court, 'title', t.title, 'sport', t.sport, 'format', t.format, 'play_date', t.play_date, 'venue', t.venue, 'settings', t.settings,
    'teams', coalesce((select jsonb_agg(jsonb_build_object('key', m.key, 'name', m.name, 'group', m.group_key, 'seed', m.seed) order by m.group_key, m.seed)
      from public.meets_tournament_teams m where m.tournament_id = t.id), '[]'::jsonb),
    'games', coalesce((select jsonb_agg(jsonb_build_object('no', g.no, 'stage', g.stage, 'group', g.group_key, 'round', g.round, 'court', g.court,
        'starts_at', to_char(g.starts_at,'HH24:MI'), 'home', g.home_ref, 'away', g.away_ref, 'label', g.label, 'place', g.place,
        'home_score', g.home_score, 'away_score', g.away_score, 'details', g.details) order by g.no)
      from public.meets_tournament_games g where g.tournament_id = t.id), '[]'::jsonb))
  from public.meets_tournament_scorers sc
  join public.meets_tournaments t on t.id = sc.tournament_id
  where sc.token = p_token
$$;
revoke all on function public.meets_scorer_tournament(uuid) from public;
grant execute on function public.meets_scorer_tournament(uuid) to anon, authenticated;

-- A result entered through a court link: only games on that court ('*' = all).
create or replace function public.meets_scorer_set_score(p_token uuid, p_no int, p_home int, p_away int, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare sc public.meets_tournament_scorers%rowtype;
begin
  select * into sc from public.meets_tournament_scorers where token = p_token;
  if not found then raise exception 'Saite vairs nedarbojas. Palūdz rīkotājam jaunu.' using errcode = '42501'; end if;
  if (p_home is null) <> (p_away is null) then raise exception 'Ievadi abu komandu rezultātu' using errcode = '22023'; end if;
  if p_home is not null and (p_home not between 0 and 999 or p_away not between 0 and 999) then
    raise exception 'Rezultātam jābūt no 0 līdz 999' using errcode = '22023';
  end if;
  update public.meets_tournament_games
    set home_score = p_home, away_score = p_away, details = public.meets_tournament_details(coalesce(p_details,'{}'::jsonb)), updated_at = now()
  where tournament_id = sc.tournament_id and no = p_no and (sc.court = '*' or court = sc.court);
  if not found then raise exception 'Šī spēle nav tavā laukumā' using errcode = '42501'; end if;
  update public.meets_tournaments set updated_at = now() where id = sc.tournament_id;
end $$;
revoke all on function public.meets_scorer_set_score(uuid, int, int, int, jsonb) from public;
grant execute on function public.meets_scorer_set_score(uuid, int, int, int, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- invitations
-- An invitation: to the whole organizer with a role, or to one event or
-- tournament (always "Labotājs"). Owners and admins invite.
drop function if exists public.meets_org_invite_create(uuid, text);
create or replace function public.meets_org_invite_create(p_organization_id uuid, p_role text, p_item_kind text default null, p_item_id uuid default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_token text; v_title text;
begin
  if not public.meets_org_can_manage(p_organization_id) then raise exception 'Nav tiesību uzaicināt lietotājus'; end if;
  if p_role not in ('admin','editor','contributor','viewer') then raise exception 'Nepareiza loma'; end if;
  if (p_item_kind is null) <> (p_item_id is null) then raise exception 'Nepareizs uzaicinājums'; end if;
  if p_item_kind is not null then
    if p_role <> 'contributor' then raise exception 'Pasākumam vai turnīram var uzaicināt tikai labotāju'; end if;
    if p_item_kind = 'event' then
      select title into v_title from public.meets_submissions where id = p_item_id and organization_id = p_organization_id;
    elsif p_item_kind = 'tournament' then
      select title into v_title from public.meets_tournaments where id = p_item_id and organization_id = p_organization_id;
    else raise exception 'Nepareizs uzaicinājums'; end if;
    if v_title is null then raise exception 'Pasākums vai turnīrs nav atrasts'; end if;
  end if;
  v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
  insert into public.meets_organization_invitations(organization_id, token_hash, role, created_by, item_kind, item_id)
  values (p_organization_id, md5(v_token), p_role, auth.uid(), p_item_kind, p_item_id);
  return jsonb_build_object('token', v_token, 'expires_in_days', 7, 'role', p_role, 'item_kind', p_item_kind, 'item_id', p_item_id, 'item_title', v_title);
end $$;
revoke all on function public.meets_org_invite_create(uuid, text, text, uuid) from public;
grant execute on function public.meets_org_invite_create(uuid, text, text, uuid) to authenticated;

create or replace function public.meets_org_invite_accept(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_inv public.meets_organization_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Pieslēdzies kontam'; end if;
  if length(coalesce(p_token,'')) > 128 then raise exception 'Nederīga saite'; end if;
  select * into v_inv from public.meets_organization_invitations
  where token_hash = md5(p_token) and claimed_at is null and expires_at > now() for update;
  if not found then raise exception 'Uzaicinājums ir beidzies vai izmantots'; end if;
  if v_inv.item_kind is not null then
    insert into public.meets_item_access(user_id, organization_id, item_kind, item_id, created_by)
    values (auth.uid(), v_inv.organization_id, v_inv.item_kind, v_inv.item_id, v_inv.created_by)
    on conflict do nothing;
  else
    if exists(select 1 from public.meets_organizations o where o.id = v_inv.organization_id and o.owner_id = auth.uid()) then
      raise exception 'Īpašnieks jau pārvalda šo organizāciju'; end if;
    insert into public.meets_organization_members(organization_id, user_id, role)
    values (v_inv.organization_id, auth.uid(), v_inv.role)
    on conflict (organization_id, user_id) do update set role = excluded.role;
  end if;
  update public.meets_organization_invitations set claimed_by = auth.uid(), claimed_at = now() where id = v_inv.id;
  return jsonb_build_object('organization_id', v_inv.organization_id, 'role', v_inv.role, 'item_kind', v_inv.item_kind, 'item_id', v_inv.item_id);
end $$;

-- The team: owner, members with roles, and people given one event or tournament.
create or replace function public.meets_org_team(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.meets_org_can_read(p_organization_id) then raise exception 'Nav tiesību'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.item_kind nulls first, t.role, t.email) from (
    select o.owner_id user_id, u.email, 'owner'::text role, null::text item_kind, null::uuid item_id, null::text item_title
    from public.meets_organizations o join auth.users u on u.id = o.owner_id where o.id = p_organization_id
    union all
    select m.user_id, u.email, m.role, null, null, null
    from public.meets_organization_members m join auth.users u on u.id = m.user_id where m.organization_id = p_organization_id
    union all
    select a.user_id, u.email, 'contributor', a.item_kind, a.item_id,
      coalesce((select s.title from public.meets_submissions s where a.item_kind = 'event' and s.id = a.item_id),
               (select t.title from public.meets_tournaments t where a.item_kind = 'tournament' and t.id = a.item_id))
    from public.meets_item_access a join auth.users u on u.id = a.user_id where a.organization_id = p_organization_id
  ) t), '[]'::jsonb);
end $$;

-- Removes a member or a person's access to one item (owners and admins).
create or replace function public.meets_org_access_remove(p_organization_id uuid, p_user uuid, p_item_kind text default null, p_item_id uuid default null)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.meets_org_can_manage(p_organization_id) then raise exception 'Nav tiesību mainīt komandu'; end if;
  if p_item_kind is null then
    delete from public.meets_organization_members where organization_id = p_organization_id and user_id = p_user;
  else
    delete from public.meets_item_access where organization_id = p_organization_id and user_id = p_user and item_kind = p_item_kind and item_id = p_item_id;
  end if;
end $$;
revoke all on function public.meets_org_access_remove(uuid, uuid, text, uuid) from public;
grant execute on function public.meets_org_access_remove(uuid, uuid, text, uuid) to authenticated;

-- Events and tournaments given to the signed-in user one by one.
create or replace function public.meets_my_item_access()
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('item_kind', a.item_kind, 'item_id', a.item_id,
    'organization_id', a.organization_id, 'organization_name', o.name,
    'title', coalesce((select s.title from public.meets_submissions s where a.item_kind = 'event' and s.id = a.item_id),
                      (select t.title from public.meets_tournaments t where a.item_kind = 'tournament' and t.id = a.item_id)))
    order by a.created_at desc), '[]'::jsonb)
  from public.meets_item_access a join public.meets_organizations o on o.id = a.organization_id
  where a.user_id = auth.uid()
$$;
revoke all on function public.meets_my_item_access() from public;
grant execute on function public.meets_my_item_access() to authenticated;

-- Changes to a published event: also by contributors and people given the event.
create or replace function public.meets_org_update_published_submission(p_id uuid, p_values jsonb)
returns public.meets_submissions language plpgsql security definer set search_path to '' as $function$
declare
  s public.meets_submissions%rowtype;
  v_venue uuid := nullif(p_values->>'venue_id','')::uuid;
begin
  select * into s from public.meets_submissions where id=p_id for update;
  if not found then raise exception 'Pasākums nav atrasts' using errcode='P0002'; end if;
  if not public.meets_can_edit_item('event', s.id, s.organization_id) then
    raise exception 'Nav tiesību labot šo pasākumu' using errcode='42501';
  end if;
  if s.event_id is null or s.status not in ('published','pending_review') then
    raise exception 'Šo pasākumu labo parastajā redaktorā' using errcode='22023';
  end if;
  if v_venue is not null and not exists(
    select 1 from public.meets_venues v where v.id=v_venue and (v.organization_id=s.organization_id or v.is_public=true)
  ) then
    raise exception 'Šo norises vietu nevar izmantot' using errcode='42501';
  end if;

  update public.meets_submissions set
    title=left(trim(coalesce(p_values->>'title',title)),200),
    description=left(coalesce(p_values->>'description',''),6000),
    category=left(coalesce(nullif(p_values->>'category',''),category),100),
    date_from=(p_values->>'date_from')::date,
    date_to=nullif(p_values->>'date_to','')::date,
    time_from=nullif(p_values->>'time_from','')::time,
    time_to=nullif(p_values->>'time_to','')::time,
    venue_id=v_venue,
    venue_name=left(coalesce(p_values->>'venue_name',''),200),
    address=left(coalesce(p_values->>'address',''),300),
    latitude=nullif(p_values->>'latitude','')::double precision,
    longitude=nullif(p_values->>'longitude','')::double precision,
    price_status=coalesce(nullif(p_values->>'price_status',''),'unknown'),
    price_min=nullif(p_values->>'price_min','')::numeric,
    price_max=nullif(p_values->>'price_max','')::numeric,
    schedule_kind=coalesce(nullif(p_values->>'schedule_kind',''),schedule_kind),
    recurrence_note=left(coalesce(p_values->>'recurrence_note',''),300),
    recurrence_slots=coalesce(p_values->'recurrence_slots','[]'::jsonb),
    status='pending_review',
    updated_at=now()
  where id=p_id
  returning * into s;
  return s;
end
$function$;
