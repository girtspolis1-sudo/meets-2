-- Replaces the one-argument draft applied earlier the same day.
drop function if exists public.meets_admin_catalog_compact(text);
drop function if exists meets_private.read_admin_catalog_compact(text);

-- The admin catalogue in a compact form for slow (mobile) connections.
-- The old form repeated 52 keys in each of ~4 000 events (6.3 MB). This one
-- sends the field names once, rows as arrays, only the fields the admin uses,
-- and the description cut to 300 characters (enough for the checks and lists).
-- Current events come first (p_past=false); the events that ended in the last
-- 14 days, which only the register shows, are loaded afterwards (p_past=true).

create or replace function meets_private.read_admin_catalog_compact(p_session_token text, p_past boolean default false)
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
    'fields',jsonb_build_array('id','title','description','date_from','date_to','time_from','time_to','time_type',
      'attendance_mode','record_type','event_type','primary_category','status','price_status','price_min','price_max',
      'venue_name','address_raw','location_precision','municipality','settlement','country_code','latitude','longitude',
      'location_quality','location_review_reason','geocode_query','geocode_candidates','geocode_suggested_at',
      'governing_body','competition_name','sport_format','tags','sources'),
    'rows',(
      select coalesce(jsonb_agg(jsonb_build_array(
        c.id,c.title,c.description,c.date_from,c.date_to,c.time_from,c.time_to,c.time_type,
        c.attendance_mode,c.record_type,c.event_type,c.primary_category,c.status,c.price_status,c.price_min,c.price_max,
        c.venue_name,c.address_raw,c.location_precision,c.municipality,c.settlement,c.country_code,c.latitude,c.longitude,
        c.location_quality,c.location_review_reason,c.geocode_query,c.geocode_candidates,c.geocode_suggested_at,
        c.governing_body,c.competition_name,c.sport_format,c.tags,c.sources
      ) order by c.date_from,c.id),'[]'::jsonb)
      from (
        select v.id,v.title,left(regexp_replace(coalesce(v.description,''),'\s+',' ','g'),300) as description,
               v.date_from,v.date_to,v.time_from,v.time_to,v.time_type,v.attendance_mode,v.record_type,v.event_type,
               v.primary_category,v.status,v.price_status,v.price_min,v.price_max,
               v.venue_name,v.address_raw,v.location_precision,v.municipality,v.settlement,v.country_code,
               round(v.latitude::numeric,6) as latitude,round(v.longitude::numeric,6) as longitude,
               l.location_quality,l.location_review_reason,l.geocode_query,
               nullif(l.geocode_candidates,'[]'::jsonb) as geocode_candidates,l.geocode_suggested_at,
               sc.governing_body,sc.name as competition_name,coalesce(sm.sport_format,sc.sport_format) as sport_format,
               (select nullif(jsonb_agg(c.name order by c.name),'[]'::jsonb)
                  from public.event_categories ec
                  join public.categories c on c.id=ec.category_id
                 where ec.event_id=v.id) as tags,
               (select coalesce(jsonb_agg(jsonb_build_object('source',s.domain,'url',es.source_url) order by es.id),'[]'::jsonb)
                  from public.event_sources es
                  join public.sources s on s.id=es.source_id
                 where es.event_id=v.id) as sources
          from public.event_overview v
          left join public.event_locations l on l.event_id=v.id
          left join public.event_sports_metadata sm on sm.event_id=v.id
          left join public.sports_competitions sc on sc.id=sm.competition_id
         where case when p_past
                 then coalesce(v.date_to,v.date_from) between (now() at time zone 'Europe/Riga')::date-14 and (now() at time zone 'Europe/Riga')::date-1
                 else coalesce(v.date_to,v.date_from)>=(now() at time zone 'Europe/Riga')::date end
      ) c
    )
  );
end
$function$;

create or replace function public.meets_admin_catalog_compact(p_session_token text default null, p_past boolean default false)
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select meets_private.read_admin_catalog_compact(p_session_token,p_past)
$function$;

revoke all on function public.meets_admin_catalog_compact(text,boolean) from public, anon;
grant execute on function public.meets_admin_catalog_compact(text,boolean) to authenticated;
revoke all on function meets_private.read_admin_catalog_compact(text,boolean) from public, anon, authenticated;
