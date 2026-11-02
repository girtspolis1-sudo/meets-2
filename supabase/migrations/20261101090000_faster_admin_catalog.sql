-- The admin catalogue hit the 8 s statement timeout while many places were being
-- approved. It now returns only events that are ahead or ended in the last two
-- weeks, without empty fields, and the mapping list counts events by index.

create index if not exists event_locations_location_source on public.event_locations(location_source);

create or replace function meets_private.read_admin_catalog(p_session_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  return jsonb_build_object(
    'fetchedAt',now(),
    'events',(
      select coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(catalog)) order by catalog.date_from,catalog.id),'[]'::jsonb)
      from (
        select v.id,v.title,v.description,v.date_from,v.date_to,v.time_from,v.time_to,v.timezone,
               v.schedule_type,v.time_type,v.attendance_mode,v.record_type,v.event_type,v.primary_category,
               v.status,v.price_status,v.price_text,v.price_min,v.price_max,v.currency,v.terms,
               v.venue_name,v.address_raw,v.alternative_address,v.location_precision,v.location_note,
               v.municipality,v.settlement,v.country_code,v.latitude,v.longitude,v.updated_at,
               l.location_quality,l.location_review_reason,l.location_basis,l.location_source,l.verified_at,
               l.geocode_query,l.geocode_candidates,l.geocode_suggested_at,
               sc.governing_body,
               sc.competition_key,
               sc.name as competition_name,
               sc.season as competition_season,
               sc.competition_type,
               coalesce(sm.sport_format,sc.sport_format) as sport_format,
               sm.stage as competition_stage,
               sm.group_name as competition_group,
               coalesce(sm.age_group,sc.default_age_group) as age_group,
               sm.home_team,sm.away_team,sm.source_match_id,
               (select coalesce(jsonb_agg(c.name order by c.name),'[]'::jsonb)
                  from public.event_categories ec
                  join public.categories c on c.id=ec.category_id
                 where ec.event_id=v.id) tags,
               (select coalesce(jsonb_agg(jsonb_build_object('source',s.domain,'url',es.source_url) order by es.id),'[]'::jsonb)
                  from public.event_sources es
                  join public.sources s on s.id=es.source_id
                 where es.event_id=v.id) sources
          from public.event_overview v
          left join public.event_locations l on l.event_id=v.id
          left join public.event_sports_metadata sm on sm.event_id=v.id
          left join public.sports_competitions sc on sc.id=sm.competition_id
         -- Older events are history: the admin works with what is ahead.
         where coalesce(v.date_to,v.date_from)>=(now() at time zone 'Europe/Riga')::date-14
      ) catalog
    )
  );
end
$function$;
