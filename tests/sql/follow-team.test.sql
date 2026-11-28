-- Tests of following a team (migration 20261128210000_follow_team.sql).
-- Runs in a scratch database prepared with tests/sql/follow-team-stub.sql; everything
-- is rolled back at the end. A failed check stops the script with an exception.
\set ON_ERROR_STOP 1
begin;

create function pg_temp.eq(p_what text, p_got anyelement, p_want anyelement) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'FAILED: % — got %, expected %',p_what,coalesce(p_got::text,'null'),coalesce(p_want::text,'null');
  end if;
end $$;
-- Runs a statement as a signed-in user and says whether the database refused it.
create function pg_temp.refused(p_uid uuid, p_sql text) returns boolean language plpgsql as $$
begin
  perform set_config('request.uid', p_uid::text, true);
  set local role authenticated;
  begin
    execute p_sql;
  exception when others then
    reset role;
    return true;
  end;
  reset role;
  return false;
end $$;

-- The key: the same as lib/team-key.js (tests/team-key.test.js).
select pg_temp.eq('key', public.meets_team_key('  RBS A.Kraukļa  VEF – U16V ', 'basketball'), 'basketball:rbs a.kraukļa vef - u16v');
select pg_temp.eq('key with a no-break space', public.meets_team_key(E'HK Zemgale / LBTU', 'ice_hockey'), 'ice_hockey:hk zemgale / lbtu');
select pg_temp.eq('no name, no key', public.meets_team_key('  ', 'basketball'), null::text);
select pg_temp.eq('tournament sport', public.meets_team_sport('basket5x5'), 'basketball');

insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into public.events values
 ('a0000000-0000-0000-0000-000000000001', 'VEF Rīga – BK Ogre', current_date + 1, current_date + 1, '19:00', 'published'),
 ('a0000000-0000-0000-0000-000000000002', 'BK Ogre – VEF Rīga', current_date + 3, current_date + 3, '18:00', 'published'),
 ('a0000000-0000-0000-0000-000000000003', 'VEF Rīga – Old', current_date - 10, current_date - 10, '18:00', 'published'),
 ('a0000000-0000-0000-0000-000000000004', 'Hidden', current_date + 2, current_date + 2, '18:00', 'private');
insert into public.event_sports_metadata(event_id, sport_format, home_team, away_team) values
 ('a0000000-0000-0000-0000-000000000001', 'basketball', 'VEF Rīga', 'BK Ogre'),
 ('a0000000-0000-0000-0000-000000000002', 'basketball', 'BK Ogre', 'VEF  Rīga'),
 ('a0000000-0000-0000-0000-000000000003', 'basketball', 'VEF Rīga', 'Old'),
 ('a0000000-0000-0000-0000-000000000004', 'basketball', 'Secret Team', 'BK Ogre');
insert into public.meets_tournaments values ('b0000000-0000-0000-0000-000000000001', 'football', 'published');
insert into public.meets_tournament_teams values ('b0000000-0000-0000-0000-000000000001', 'a', 'FK Mārupe');

select pg_temp.eq('a league team can be followed', public.meets_team_follow_valid('basketball:vef rīga'), true);
select pg_temp.eq('a tournament team can be followed', public.meets_team_follow_valid('football:fk mārupe'), true);
select pg_temp.eq('a team only in a private event cannot', public.meets_team_follow_valid('basketball:secret team'), false);

select pg_temp.eq('own follow', pg_temp.refused('11111111-1111-1111-1111-111111111111',
 $$insert into public.meets_user_team_follows(user_id, team_key, team_name, sport) values ('11111111-1111-1111-1111-111111111111', 'basketball:vef rīga', 'VEF Rīga', 'basketball')$$), false);
select pg_temp.eq('not for another user', pg_temp.refused('11111111-1111-1111-1111-111111111111',
 $$insert into public.meets_user_team_follows(user_id, team_key, team_name, sport) values ('22222222-2222-2222-2222-222222222222', 'basketball:vef rīga', 'VEF Rīga', 'basketball')$$), true);
select pg_temp.eq('not an unknown team', pg_temp.refused('11111111-1111-1111-1111-111111111111',
 $$insert into public.meets_user_team_follows(user_id, team_key, team_name, sport) values ('11111111-1111-1111-1111-111111111111', 'basketball:nobody', 'Nobody', 'basketball')$$), true);
select pg_temp.eq('the key matches the name', pg_temp.refused('11111111-1111-1111-1111-111111111111',
 $$insert into public.meets_user_team_follows(user_id, team_key, team_name, sport) values ('11111111-1111-1111-1111-111111111111', 'basketball:bk ogre', 'VEF Rīga', 'basketball')$$), true);

-- What the signed-in users see.
select set_config('request.uid', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select pg_temp.eq('own rows', (select count(*)::int from public.meets_user_team_follows), 1);
select pg_temp.eq('coming games, home and away, no ended or private ones',
 (select string_agg(g ->> 'event_id', ',') from jsonb_array_elements(public.meets_team_follow_games()) g),
 'a0000000-0000-0000-0000-000000000001,a0000000-0000-0000-0000-000000000002');
select pg_temp.eq('the profile list takes them', jsonb_array_length(public.meets_followed_event_ids()), 2);
reset role;
select set_config('request.uid', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select pg_temp.eq('another user sees none', (select count(*)::int from public.meets_user_team_follows), 0);
reset role;
select pg_temp.eq('anonymous visitors cannot read follows', pg_temp.refused('00000000-0000-0000-0000-000000000000',
 $$set local role anon; select count(*) from public.meets_user_team_follows$$), true);

rollback;
