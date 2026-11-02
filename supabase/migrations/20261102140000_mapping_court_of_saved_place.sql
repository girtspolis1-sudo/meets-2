-- A court or hall of a saved place gets the saved place's point automatically:
-- "OC Ventspils, 1.laukums" and "Liepājas OC, 4.lauk." use the mapping of
-- "OC Ventspils" / "Liepājas OC". The name keeps the court, so visitors see it.

create or replace function meets_private.location_base_hall_name(p_name text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select trim(regexp_replace(regexp_replace(coalesce(p_name,''),
    '[,(;[:space:]-]*\(?[[:space:]]*([0-9]+[[:space:]]*\.?[[:space:]]*(laukums|lauk\.?|zāle|zale|z\.|korts|court)|(laukums|zāle|zale|korts)[[:space:]]*[0-9]+|maz[aā] z[aā]le|liel[aā] z[aā]le)[[:space:]]*\)?[[:space:]]*$','','i'),
    '[,(;[:space:]-]*\(?[[:space:]]*([0-9]+[[:space:]]*\.?[[:space:]]*(laukums|lauk\.?|zāle|zale|z\.|korts|court)|(laukums|zāle|zale|korts)[[:space:]]*[0-9]+|maz[aā] z[aā]le|liel[aā] z[aā]le)[[:space:]]*\)?[[:space:]]*$','','i'))
$function$;

create or replace function meets_private.apply_saved_location_mapping_before_write()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_alias_text text;
  v_alias_normalized text;
  v_base_normalized text;
  v_municipality_id bigint;
  v_mapping meets_private.location_alias_mappings%rowtype;
  v_old_mapping_id uuid;
  v_part_of_hall boolean := false;
begin
  if tg_op='UPDATE'
     and coalesce(old.location_source,'') like 'admin mapping:%'
     and (
       new.location_source is not distinct from old.location_source
       or new.location_source is null
     )
  then
    begin
      v_old_mapping_id := replace(old.location_source,'admin mapping:','')::uuid;
    exception when others then
      v_old_mapping_id := null;
    end;

    if v_old_mapping_id is not null then
      select m.*
        into v_mapping
        from meets_private.location_alias_mappings m
       where m.id=v_old_mapping_id
         and m.active
       limit 1;
      v_part_of_hall := coalesce(old.location_basis,'')='saved admin mapping (court of saved place)';
    end if;
  end if;

  if v_mapping.id is null then
    v_alias_text := coalesce(
      nullif(trim(new.venue_name),''),
      nullif(trim(new.address_raw),'')
    );

    if v_alias_text is null then
      return new;
    end if;

    v_alias_normalized := meets_private.normalize_location_alias(v_alias_text);
    if length(v_alias_normalized) < 3 then
      return new;
    end if;

    v_municipality_id := coalesce(new.municipality_id,new.source_municipality_id);

    -- An event without a country matches a mapping for any country; its municipality still has to agree.
    select m.*
      into v_mapping
      from meets_private.location_alias_mappings m
     where m.active
       and m.alias_normalized=v_alias_normalized
       and (m.municipality_id is null or m.municipality_id=v_municipality_id)
       and (m.country_code is null or new.country_code is null or m.country_code=new.country_code)
     order by
       case when m.municipality_id is not null then 1 else 0 end desc,
       case when m.country_code is not null then 1 else 0 end desc,
       m.updated_at desc
     limit 1;

    -- No exact match: the same name without a court or hall ("OC Ventspils, 1.laukums").
    if v_mapping.id is null then
      v_base_normalized := meets_private.normalize_location_alias(meets_private.location_base_hall_name(v_alias_text));
      if length(v_base_normalized) >= 3 and v_base_normalized<>v_alias_normalized then
        select m.*
          into v_mapping
          from meets_private.location_alias_mappings m
         where m.active
           and m.alias_normalized=v_base_normalized
           and (m.municipality_id is null or m.municipality_id=v_municipality_id)
           and (m.country_code is null or new.country_code is null or m.country_code=new.country_code)
         order by
           case when m.municipality_id is not null then 1 else 0 end desc,
           case when m.country_code is not null then 1 else 0 end desc,
           m.updated_at desc
         limit 1;
        v_part_of_hall := v_mapping.id is not null;
      end if;
    end if;
  end if;

  if v_mapping.id is null then
    return new;
  end if;

  -- A court keeps its own name; the place itself takes the saved name.
  if not v_part_of_hall then
    new.venue_name := v_mapping.canonical_venue_name;
  end if;
  new.address_raw := coalesce(
    nullif(v_mapping.canonical_address_text,''),
    new.address_raw
  );
  new.address_normalized := coalesce(
    nullif(v_mapping.canonical_address_text,''),
    new.address_normalized
  );
  new.venue_point := extensions.st_setsrid(
    extensions.st_makepoint(v_mapping.longitude,v_mapping.latitude),
    4326
  )::extensions.geography;
  new.fallback_point := null;
  new.alternative_address := null;
  new.location_precision := 'venue';
  new.location_basis := case when v_part_of_hall then 'saved admin mapping (court of saved place)' else 'saved admin mapping' end;
  new.location_source := 'admin mapping:'||v_mapping.id::text;
  new.verified_at := now();
  new.location_note := case when v_part_of_hall
    then 'Lokācija automātiski piemērota no saglabātās vietas “'||v_mapping.alias_text||'” (tā pati ēka, cits laukums vai zāle).'
    else 'Lokācija automātiski piemērota no admin adreses mappinga.' end;
  new.location_quality := 'verified_exact';
  new.location_review_reason := null;
  new.geocode_query := null;
  new.geocode_candidates := '[]'::jsonb;
  new.geocode_suggested_at := null;
  new.country_code := coalesce(new.country_code,v_mapping.country_code);

  update meets_private.location_alias_mappings
     set apply_count=apply_count+1,
         last_applied_at=now()
   where id=v_mapping.id;

  return new;
end
$function$;

-- Current events at a court of a saved place: apply the place and publish what is ready.
do $$
declare r record;
begin
  for r in
    select l.event_id
      from public.event_locations l
      join public.events e on e.id=l.event_id
     where l.verified_at is null
       and coalesce(e.date_to,e.date_from)>=current_date
       and meets_private.location_base_hall_name(l.venue_name)<>trim(coalesce(l.venue_name,''))
  loop
    update public.event_locations set venue_name=venue_name where event_id=r.event_id;
    perform meets_private.import_publish_if_ready(r.event_id);
  end loop;
end $$;
