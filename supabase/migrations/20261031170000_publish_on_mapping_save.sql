-- Approving a place publishes its events at once instead of at the next hourly
-- auto-publish run, and says how many were published.

create or replace function meets_private.admin_save_location_mapping(p_session_token text, p_sample_event_id uuid, p_venue_name text, p_address_text text, p_latitude double precision, p_longitude double precision)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_location public.event_locations%rowtype;
  v_alias_text text;
  v_original_address text;
  v_alias_normalized text;
  v_municipality_id bigint;
  v_country_code text;
  v_mapping_id uuid;
  v_updated integer := 0;
  v_published integer := 0;
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < 53.5 or p_latitude > 60.8
     or p_longitude < 16.0 or p_longitude > 31.5
  then
    raise exception 'Coordinates outside Baltic review bounds' using errcode='22023';
  end if;

  if nullif(trim(coalesce(p_venue_name,'')),'') is null then
    raise exception 'Venue name is required' using errcode='22023';
  end if;

  select l.* into v_location
  from public.event_locations l
  where l.event_id=p_sample_event_id;

  if v_location.event_id is null then
    raise exception 'Event location not found' using errcode='P0002';
  end if;

  v_alias_text := coalesce(
    nullif(trim(v_location.venue_name),''),
    nullif(trim(v_location.address_raw),'')
  );
  v_original_address := nullif(trim(v_location.address_raw),'');
  v_alias_normalized := meets_private.normalize_location_alias(v_alias_text);
  v_municipality_id := coalesce(v_location.municipality_id,v_location.source_municipality_id);
  v_country_code := v_location.country_code;

  if length(v_alias_normalized) < 3 then
    raise exception 'Location alias is too short for reusable mapping' using errcode='22023';
  end if;

  select id into v_mapping_id
  from meets_private.location_alias_mappings
  where alias_normalized=v_alias_normalized
    and municipality_id is not distinct from v_municipality_id
    and country_code is not distinct from v_country_code
  limit 1;

  if v_mapping_id is null then
    insert into meets_private.location_alias_mappings(
      alias_text,original_address_text,alias_normalized,
      municipality_id,country_code,
      canonical_venue_name,canonical_address_text,
      latitude,longitude,source_event_id,
      active,created_by,updated_by,deactivated_at
    )
    values(
      v_alias_text,v_original_address,v_alias_normalized,
      v_municipality_id,v_country_code,
      trim(p_venue_name),nullif(trim(coalesce(p_address_text,'')),''),
      p_latitude,p_longitude,p_sample_event_id,
      true,'admin','admin',null
    )
    returning id into v_mapping_id;
  else
    update meets_private.location_alias_mappings
    set alias_text=v_alias_text,
        original_address_text=coalesce(original_address_text,v_original_address),
        canonical_venue_name=trim(p_venue_name),
        canonical_address_text=nullif(trim(coalesce(p_address_text,'')),''),
        latitude=p_latitude,
        longitude=p_longitude,
        source_event_id=p_sample_event_id,
        active=true,
        updated_by='admin',
        deactivated_at=null,
        updated_at=now()
    where id=v_mapping_id;
  end if;

  update public.event_locations l
  set venue_name=trim(p_venue_name),
      address_raw=coalesce(nullif(trim(coalesce(p_address_text,'')),''),l.address_raw),
      address_normalized=coalesce(nullif(trim(coalesce(p_address_text,'')),''),l.address_normalized),
      venue_point=extensions.st_setsrid(
        extensions.st_makepoint(p_longitude,p_latitude),4326
      )::extensions.geography,
      fallback_point=null,
      alternative_address=null,
      location_precision='venue',
      location_basis='saved admin mapping',
      location_source='admin mapping:'||v_mapping_id::text,
      verified_at=now(),
      location_note='Lokācija apstiprināta ar atkārtoti izmantojamu admin mappingu.',
      location_quality='verified_exact',
      location_review_reason=null,
      geocode_query=null,
      geocode_candidates='[]'::jsonb,
      geocode_suggested_at=null
  where meets_private.normalize_location_alias(
          coalesce(nullif(trim(l.venue_name),''),nullif(trim(l.address_raw),''))
        )=v_alias_normalized
    and coalesce(l.municipality_id,l.source_municipality_id)
          is not distinct from v_municipality_id
    and l.country_code is not distinct from v_country_code;

  get diagnostics v_updated=row_count;

  update meets_private.location_alias_mappings
  set apply_count=apply_count+v_updated,
      last_applied_at=case when v_updated>0 then now() else last_applied_at end,
      updated_at=now()
  where id=v_mapping_id;

  -- Imported events whose place is now verified go public right away.
  v_published := meets_private.auto_publish_verified_imports();

  return jsonb_build_object(
    'ok',true,'mapping_id',v_mapping_id,'alias_text',v_alias_text,
    'updated_events',v_updated,'published_events',v_published,'active',true
  );
end
$function$;

-- Events approved before this change are published now.
select meets_private.auto_publish_verified_imports();
