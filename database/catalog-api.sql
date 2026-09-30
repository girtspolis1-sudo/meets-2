-- Canonical public catalogue RPC for MEETS 2.
-- Public events are intentionally readable through a narrow RPC only.
-- Underlying tables/views remain unavailable to anon/authenticated roles.

begin;

revoke execute on function meets_private.read_public_catalog(text)
from public, anon, authenticated;

-- Transition-safe compatibility: remove the old DEFAULT from the text signature
-- so both the new no-arg RPC and the old explicit p_token call can coexist.
create or replace function public.meets_public_catalog(p_token text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'fetchedAt', now(),
    'competitions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'competition_key', sc.competition_key,
          'name', sc.name,
          'season', sc.season,
          'governing_body', sc.governing_body,
          'sport_format', sc.sport_format,
          'competition_type', sc.competition_type,
          'source_url', sc.source_url
        ) order by sc.name
      ), '[]'::jsonb)
      from public.sports_competitions sc
      where sc.active = true
    ),
    'events', (
      select coalesce(
        jsonb_agg(to_jsonb(catalog) order by catalog.date_from, catalog.id),
        '[]'::jsonb
      )
      from (
        select
          v.id, v.title, v.description, v.date_from, v.date_to, v.time_from, v.time_to, v.timezone,
          v.schedule_type, v.time_type, v.attendance_mode, v.record_type, v.event_type, v.primary_category,
          v.status, v.price_status, v.price_text, v.price_min, v.price_max, v.currency, v.terms,
          v.venue_name, v.address_raw, v.alternative_address, v.location_precision, v.location_note,
          v.municipality, v.settlement, v.country_code, v.latitude, v.longitude, v.updated_at,
          sc.governing_body, sc.competition_key, sc.name as competition_name, sc.season as competition_season,
          sc.competition_type, coalesce(sm.sport_format, sc.sport_format) as sport_format,
          sm.stage as competition_stage, sm.group_name as competition_group,
          coalesce(sm.age_group, sc.default_age_group) as age_group,
          sm.home_team, sm.away_team, sm.source_match_id,
          (
            select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb)
            from public.event_categories ec
            join public.categories c on c.id = ec.category_id
            where ec.event_id = v.id
          ) as tags,
          (
            select coalesce(
              jsonb_agg(jsonb_build_object('source', s.domain, 'url', es.source_url) order by es.id),
              '[]'::jsonb
            )
            from public.event_sources es
            join public.sources s on s.id = es.source_id
            where es.event_id = v.id
          ) as sources
        from public.event_overview v
        left join public.event_sports_metadata sm on sm.event_id = v.id
        left join public.sports_competitions sc on sc.id = sm.competition_id
        where v.status = 'published'
      ) catalog
    )
  )
$$;

create or replace function public.meets_public_catalog()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'fetchedAt', now(),
    'competitions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'competition_key', sc.competition_key,
          'name', sc.name,
          'season', sc.season,
          'governing_body', sc.governing_body,
          'sport_format', sc.sport_format,
          'competition_type', sc.competition_type,
          'source_url', sc.source_url
        ) order by sc.name
      ), '[]'::jsonb)
      from public.sports_competitions sc
      where sc.active = true
    ),
    'events', (
      select coalesce(
        jsonb_agg(to_jsonb(catalog) order by catalog.date_from, catalog.id),
        '[]'::jsonb
      )
      from (
        select
          v.id, v.title, v.description, v.date_from, v.date_to, v.time_from, v.time_to, v.timezone,
          v.schedule_type, v.time_type, v.attendance_mode, v.record_type, v.event_type, v.primary_category,
          v.status, v.price_status, v.price_text, v.price_min, v.price_max, v.currency, v.terms,
          v.venue_name, v.address_raw, v.alternative_address, v.location_precision, v.location_note,
          v.municipality, v.settlement, v.country_code, v.latitude, v.longitude, v.updated_at,
          sc.governing_body, sc.competition_key, sc.name as competition_name, sc.season as competition_season,
          sc.competition_type, coalesce(sm.sport_format, sc.sport_format) as sport_format,
          sm.stage as competition_stage, sm.group_name as competition_group,
          coalesce(sm.age_group, sc.default_age_group) as age_group,
          sm.home_team, sm.away_team, sm.source_match_id,
          (
            select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb)
            from public.event_categories ec
            join public.categories c on c.id = ec.category_id
            where ec.event_id = v.id
          ) as tags,
          (
            select coalesce(
              jsonb_agg(jsonb_build_object('source', s.domain, 'url', es.source_url) order by es.id),
              '[]'::jsonb
            )
            from public.event_sources es
            join public.sources s on s.id = es.source_id
            where es.event_id = v.id
          ) as sources
        from public.event_overview v
        left join public.event_sports_metadata sm on sm.event_id = v.id
        left join public.sports_competitions sc on sc.id = sm.competition_id
        where v.status = 'published'
      ) catalog
    )
  )
$$;

-- Temporary backwards-compatible signature for any deployment still sending
-- {"p_token": null}. The argument has no authorization meaning.
create or replace function public.meets_public_catalog(p_token text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.meets_public_catalog()
$$;

revoke all on function public.meets_public_catalog()
from public, anon, authenticated, service_role;
revoke all on function public.meets_public_catalog(text)
from public, anon, authenticated, service_role;

grant execute on function public.meets_public_catalog()
to anon, service_role;
grant execute on function public.meets_public_catalog(text)
to anon, service_role;

comment on function public.meets_public_catalog() is
'MEETS 2 public read-only catalogue. Returns explicitly selected published event data only.';
comment on function public.meets_public_catalog(text) is
'Deprecated compatibility wrapper. p_token is ignored; remove after all deployments use the no-arg RPC.';

notify pgrst, 'reload schema';

commit;
