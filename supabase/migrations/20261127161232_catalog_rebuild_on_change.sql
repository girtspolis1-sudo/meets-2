-- The public catalogue snapshot was rebuilt from scratch every minute (about 70% of all
-- database time, 3 s per build, a new 2.8 MB row and its WAL each minute), although the
-- events change in a few dozen minutes a day. It is now rebuilt only after a change in
-- one of the tables it is built from, and at least once an hour as a safety net.
-- The build itself aggregates sources and categories once instead of three subqueries
-- per event. Its result is unchanged (checked against the previous body: equal jsonb
-- apart from fetchedAt).

-- One row per writing transaction that touched a catalogue table. Each transaction
-- writes its own key, so writers never wait for each other or for the rebuild
-- (a single "dirty" row would be locked by long transactions such as
-- location_auto_run; a sequence would also count transactions that are not committed
-- yet, so the rebuild could miss them).
create table if not exists meets_private.public_catalog_changes (
  txid bigint primary key,
  changed_at timestamptz not null default now()
);
alter table meets_private.public_catalog_changes enable row level security;
revoke all on table meets_private.public_catalog_changes from public, anon, authenticated;

create or replace function meets_private.note_public_catalog_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into meets_private.public_catalog_changes (txid)
  values (txid_current())
  on conflict (txid) do nothing;
  return null;
end
$function$;
revoke all on function meets_private.note_public_catalog_change() from public, anon, authenticated;

-- Every table build_public_catalog() reads, including the ones behind event_overview.
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.events for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.event_locations for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.municipalities for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.settlements for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.event_sources for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.sources for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.event_categories for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.categories for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.event_sports_metadata for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.sports_competitions for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.meets_published_occurrences for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.meets_submissions for each statement execute function meets_private.note_public_catalog_change();
create or replace trigger meets_public_catalog_change after insert or update or delete or truncate
  on public.meets_organizations for each statement execute function meets_private.note_public_catalog_change();

-- Same result as 20261127093420_sport_level.sql, built with one pass over the sources,
-- categories and organizer rows instead of correlated subqueries per event.
create or replace function meets_private.build_public_catalog()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
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
      ) catalog
    )
  )
$function$;
revoke all on function meets_private.build_public_catalog() from public, anon, authenticated;

create or replace function meets_private.refresh_public_catalog()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_changes integer;
begin
  -- A build that runs longer than a minute must not be joined by a second one. The lock
  -- is taken before the change rows are read, so a skipped run leaves them in place.
  if not pg_try_advisory_xact_lock(201026, 1121) then
    return;
  end if;

  -- First take the changes, then build. Every statement here gets its own snapshot
  -- (READ COMMITTED), so the build sees at least every transaction whose change row
  -- this delete removed. Rows of transactions still running are not visible to the
  -- delete and stay for the next run, so no change is lost.
  delete from meets_private.public_catalog_changes;
  get diagnostics v_changes = row_count;

  -- Nothing changed: keep the stored copy, but rebuild at least once an hour.
  if v_changes = 0 and exists (
    select 1 from meets_private.public_catalog_snapshot
    where id = 1 and built_at > now() - interval '1 hour'
  ) then
    return;
  end if;

  insert into meets_private.public_catalog_snapshot (id, data, built_at)
  values (1, meets_private.build_public_catalog(), now())
  on conflict (id) do update set data = excluded.data, built_at = excluded.built_at;
end
$function$;
revoke all on function meets_private.refresh_public_catalog() from public, anon, authenticated;

-- The next cron run rebuilds once with the new body.
insert into meets_private.public_catalog_changes (txid) values (txid_current()) on conflict do nothing;
