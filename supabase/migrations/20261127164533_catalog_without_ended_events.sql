-- About half of the stored public catalogue (3 095 of 6 375 events, ~5 MB of 11 MB)
-- were events that have already ended. The site needs them only for the page of one
-- ended event ("Pasākums ir beidzies"), yet every server copy loaded all of them.
-- The catalogue now holds events that end today or later; one ended event is read on
-- its own through meets_public_ended_event().
--
-- The event record is defined once, in meets_private.public_catalog_events, and both
-- the catalogue build and the single-event read use it.

create or replace view meets_private.public_catalog_events as
  with src as (
    -- Sources of every event in one pass: map visibility and the public list together.
    select es.event_id,
           bool_or(s.map_visible) as map_visible,
           jsonb_agg(jsonb_build_object('source', s.domain, 'url', es.source_url) order by es.id) as sources
    from public.event_sources es
    join public.sources s on s.id = es.source_id
    group by es.event_id
  ),
  tags as (
    select ec.event_id, jsonb_agg(c.name order by c.name) as tags
    from public.event_categories ec
    join public.categories c on c.id = ec.category_id
    group by ec.event_id
  ),
  org as (
    -- meets_published_occurrences.event_id is unique: at most one row per event.
    select po.event_id,
           s.cover_image_path,
           case when o.is_public then o.id end as organization_id,
           case when o.is_public then o.name end as organizer_name
    from public.meets_published_occurrences po
    join public.meets_submissions s on s.id = po.submission_id
    left join public.meets_organizations o on o.id = s.organization_id
    where s.status = 'published'
  )
  select catalog.id,
         catalog.date_from,
         coalesce(catalog.date_to, catalog.date_from) as end_date,
         catalog.map_visible,
         to_jsonb(catalog) as event
  from (
    select
      v.id,
      org.cover_image_path,
      org.organization_id,
      org.organizer_name,
      -- The call link is public only for events that take place online.
      case when ev.attendance_mode in ('online','hybrid') then ev.online_url end as online_url,
      coalesce(src.map_visible, true) as map_visible,
      v.title, v.description, v.date_from, v.date_to, v.time_from, v.time_to, v.timezone,
      v.schedule_type, v.time_type, v.attendance_mode, v.record_type, v.event_type, v.primary_category,
      v.status, v.price_status, v.price_text, v.price_min, v.price_max, v.currency, v.terms,
      v.venue_name, v.address_raw, v.alternative_address, v.location_precision, v.location_note,
      v.municipality, v.settlement, v.country_code, v.latitude, v.longitude, v.updated_at,
      sc.governing_body, sc.competition_key, sc.name as competition_name, sc.season as competition_season,
      sc.competition_type, coalesce(sm.sport_format, sc.sport_format) as sport_format,
      sm.stage as competition_stage, sm.group_name as competition_group,
      coalesce(sm.age_group, sc.default_age_group) as age_group,
      sc.level as sport_level,
      sm.home_team, sm.away_team, sm.source_match_id,
      coalesce(tags.tags, '[]'::jsonb) as tags,
      coalesce(src.sources, '[]'::jsonb) as sources
    from public.event_overview v
    join public.events ev on ev.id = v.id
    left join public.event_sports_metadata sm on sm.event_id = v.id
    left join public.sports_competitions sc on sc.id = sm.competition_id
    left join org on org.event_id = v.id
    left join src on src.event_id = v.id
    left join tags on tags.event_id = v.id
    where v.status = 'published'
      -- A paused competition must hide its events as well as its filter option.
      and (sc.id is null or sc.active = true)
  ) catalog;
revoke all on table meets_private.public_catalog_events from public, anon, authenticated;
comment on view meets_private.public_catalog_events is
  'One public catalogue record per published event (event jsonb), used by build_public_catalog() and meets_public_ended_event().';

-- Only events that end today or later (Riga). The build now depends on the date: the
-- hourly rebuild of refresh_public_catalog() drops the events of yesterday after midnight,
-- and until then the site filters them by date itself.
create or replace function meets_private.build_public_catalog()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
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
      select coalesce(jsonb_agg(pe.event order by pe.date_from, pe.id), '[]'::jsonb)
      from meets_private.public_catalog_events pe
      where pe.end_date >= (now() at time zone 'Europe/Riga')::date
    )
  )
$function$;
revoke all on function meets_private.build_public_catalog() from public, anon, authenticated;

-- One ended event for its page: by the full id or by the first 8 characters of the id
-- (the end of the event address). Same rules as the site used for its list of ended
-- events: shown on the map, with a date, ended within the last six months (Riga).
-- When several events share the 8 characters, the earliest (date_from, id) wins, as
-- in that list. Server only: never called from the browser.
create or replace function public.meets_public_ended_event(p_key text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_key text := lower(btrim(coalesce(p_key, '')));
  v_today date := (now() at time zone 'Europe/Riga')::date;
  v_from date := (v_today - interval '6 months')::date;
  v_lo uuid;
  v_hi uuid;
  v_id uuid;
  v_event jsonb;
begin
  if v_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_lo := v_key::uuid;
    v_hi := v_lo;
  elsif v_key ~ '^[0-9a-f]{8}$' then
    v_lo := (v_key || '-0000-0000-0000-000000000000')::uuid;
    v_hi := (v_key || '-ffff-ffff-ffff-ffffffffffff')::uuid;
  else
    return null;
  end if;

  -- Candidates through the primary key; each is then read by its id, so the
  -- aggregates in the view are limited to that one event.
  for v_id in
    select e.id from public.events e
    where e.id between v_lo and v_hi and e.status = 'published'
    order by e.date_from, e.id
  loop
    select pe.event into v_event
    from meets_private.public_catalog_events pe
    where pe.id = v_id
      and pe.date_from is not null
      and pe.map_visible is not false
      and pe.end_date < v_today
      and pe.end_date >= v_from;
    if found then
      return v_event;
    end if;
  end loop;
  return null;
end
$function$;
revoke all on function public.meets_public_ended_event(text) from public, anon, authenticated;
grant execute on function public.meets_public_ended_event(text) to anon, service_role;
comment on function public.meets_public_ended_event(text) is
  'MEETS 2: one published event that ended within the last six months, by full id or 8-character id prefix. Same record as meets_public_catalog() events.';

notify pgrst, 'reload schema';

-- Rebuild the stored catalogue without the ended events on the next cron run.
insert into meets_private.public_catalog_changes (txid) values (txid_current()) on conflict do nothing;
