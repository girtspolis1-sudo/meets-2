-- The site version that reads ended events through meets_public_ended_event() is in
-- production (PR #166), so the stored catalogue again holds only events that end today
-- or later (Riga), as planned in 20261127164533. About half the size.
-- The hourly rebuild of refresh_public_catalog() drops the events of yesterday after
-- midnight; until then the site filters them by date itself.
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

insert into meets_private.public_catalog_changes (txid) values (txid_current()) on conflict do nothing;
