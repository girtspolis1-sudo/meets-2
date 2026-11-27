-- The site version in production still reads ended events from the stored catalogue
-- (findPublicEvent). Until the version that reads them through
-- meets_public_ended_event() is deployed, the catalogue keeps every published event.
-- Same records as before (meets_private.public_catalog_events), no date filter.
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
    )
  )
$function$;
revoke all on function meets_private.build_public_catalog() from public, anon, authenticated;

insert into meets_private.public_catalog_changes (txid) values (txid_current()) on conflict do nothing;
