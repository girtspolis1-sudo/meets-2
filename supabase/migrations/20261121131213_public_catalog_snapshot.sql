-- The public catalogue is built once a minute and stored, so reading it is a
-- single-row lookup. Building it takes 2–4 s on its own and 8–12 s when the
-- home page, map, event pages and sitemap ask at the same time, which ran past
-- the API statement timeout (error 57014) and left the site without events.

create table if not exists meets_private.public_catalog_snapshot (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null,
  built_at timestamptz not null default now()
);
alter table meets_private.public_catalog_snapshot enable row level security;
revoke all on table meets_private.public_catalog_snapshot from public, anon, authenticated;

-- The former body of public.meets_public_catalog(), unchanged.
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
          coalesce((select bool_or(s.map_visible) from public.event_sources es
            join public.sources s on s.id=es.source_id where es.event_id=v.id),true) as map_visible,
          v.title, v.description, v.date_from, v.date_to, v.time_from, v.time_to, v.timezone,
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
        join public.events ev on ev.id = v.id
        left join public.event_sports_metadata sm on sm.event_id = v.id
        left join public.sports_competitions sc on sc.id = sm.competition_id
        left join lateral (
          select s.cover_image_path,
                 case when o.is_public then o.id end as organization_id,
                 case when o.is_public then o.name end as organizer_name
          from public.meets_published_occurrences po
          join public.meets_submissions s on s.id = po.submission_id
          left join public.meets_organizations o on o.id = s.organization_id
          where po.event_id = v.id and s.status = 'published'
          limit 1
        ) org on true
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
 language sql
 security definer
 set search_path to ''
as $function$
  insert into meets_private.public_catalog_snapshot (id, data, built_at)
  values (1, meets_private.build_public_catalog(), now())
  on conflict (id) do update set data = excluded.data, built_at = excluded.built_at;
$function$;
revoke all on function meets_private.refresh_public_catalog() from public, anon, authenticated;

-- Readers get the stored copy; only before the first build is it made on the spot.
create or replace function public.meets_public_catalog()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select coalesce(
    (select data from meets_private.public_catalog_snapshot where id = 1),
    meets_private.build_public_catalog()
  )
$function$;
comment on function public.meets_public_catalog() is
  'MEETS 2 public read-only catalogue. Returns explicitly selected published event data only. Served from meets_private.public_catalog_snapshot, rebuilt every minute.';

select meets_private.refresh_public_catalog();

select cron.unschedule(jobid) from cron.job where jobname = 'meets-public-catalog-snapshot';
select cron.schedule('meets-public-catalog-snapshot', '* * * * *', 'select meets_private.refresh_public_catalog()');
