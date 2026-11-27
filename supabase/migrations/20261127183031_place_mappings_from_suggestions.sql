-- Place suggestions approved by the owner (27.11). OpenStreetMap / saved-mapping
-- suggestions shown in admin "Vietas" whose name matches the venue of the event text.
-- Each is saved as a reusable place mapping, exactly as the admin button "Apstiprināt"
-- does (meets_private.admin_save_location_mapping, without the admin session check):
-- the mapping is created or updated, every location with the same normalized name,
-- municipality and country gets the point and is verified, and verified imports are
-- published. Not included: suggestions with another building, town or parish centres,
-- and "Jēkabpils sporta halle" (not confirmed).

do $migration$
declare
  r record;
  v_location public.event_locations%rowtype;
  v_alias_text text;
  v_original_address text;
  v_alias_normalized text;
  v_municipality_id bigint;
  v_country_code text;
  v_mapping_id uuid;
  v_updated integer;
  v_total integer := 0;
  v_published integer;
begin
  for r in
    select * from (values
      ('23c87418-78cb-447e-b6e0-53a46e357b1b'::uuid,'Vidzemes Ledus halle','Vidzemes ledus halle, 3, Mežezera iela, Aizupes, Tīnūžu pagasts, Ogres novads, LV-5001, Latvija',56.8257816,24.600211),
      ('2311aca0-b14e-4904-a837-577bd0db03bc'::uuid,'Ulbrokas vidusskola','Ulbrokas vidusskola, Institūta iela, Vālodzes, Ulbroka, Stopiņu pagasts, Ropažu novads, LV-2119, Latvija',56.9291008,24.3208208),
      ('10664c71-7164-4080-8cea-96dcd5cb6d34'::uuid,'Jūrmalas Aspazijas pamatskola','Aizputes iela 1A, Jūrmala, LV-2010',56.981577,23.86259),
      ('646db9e5-96a6-4b54-909b-4249d1631146'::uuid,'Ozo ledus halle','OZO ledus halle, 5B, Stadiona iela, Ozolnieki, Ozolnieku pagasts, Jelgavas novads, LV-3018, Latvija',56.6911658,23.7895953),
      ('11c51fbf-32c7-435b-bb87-087216436453'::uuid,'Vaiņodes vidusskola','Vaiņodes vidusskola, 4, Avotu iela, Vaiņode, Vaiņodes pagasts, Dienvidkurzemes novads, LV-3435, Latvija',56.4223442,21.8561124),
      ('3517ef51-0c61-4868-bda9-5891965f2070'::uuid,'Spuņciema Sporta halle','Spuņciema Sporta Halle, 2, Mazā Spuņciema iela, Spuņciems, Salas pagasts, Mārupes novads, LV-2105, Latvija',56.9274505,23.6885265),
      ('bef0d08b-7992-448b-a0a8-1fe942dbb2e8'::uuid,'Olaines slidotava','Olaines slidotava, Zeiferta iela, Olaine, Olaines novads, LV-2114, Latvija',56.7882377,23.9387001),
      ('2eabe084-0814-4201-a090-cb7122555da9'::uuid,'Tārgales pamatskola','Tārgales pamatskola, Pope — Elkšķene — Tārgale, Tārgale, Tārgales pagasts, Ventspils novads, LV-3621, Latvija',57.3307841,21.6445826),
      ('e4f6b955-8db1-47fb-92a7-8347981f4fe4'::uuid,'Teikas vsk.','Teikas vidusskola, Aizkraukles iela, Teika, Teikas apkaime, Rīga, LV-1006, Latvija',56.9752918,24.1833567)
    ) as t(sample_event_id, venue_name, address_text, latitude, longitude)
  loop
    select l.* into v_location from public.event_locations l where l.event_id = r.sample_event_id;
    if v_location.event_id is null then
      raise notice 'skipped %: event location not found', r.venue_name;
      continue;
    end if;

    v_alias_text := coalesce(nullif(trim(v_location.venue_name),''), nullif(trim(v_location.address_raw),''));
    v_original_address := nullif(trim(v_location.address_raw),'');
    v_alias_normalized := meets_private.normalize_location_alias(v_alias_text);
    v_municipality_id := coalesce(v_location.municipality_id, v_location.source_municipality_id);
    v_country_code := v_location.country_code;
    v_mapping_id := null;

    select id into v_mapping_id
    from meets_private.location_alias_mappings
    where alias_normalized = v_alias_normalized
      and municipality_id is not distinct from v_municipality_id
      and country_code is not distinct from v_country_code
    limit 1;

    if v_mapping_id is null then
      insert into meets_private.location_alias_mappings(
        alias_text, original_address_text, alias_normalized,
        municipality_id, country_code,
        canonical_venue_name, canonical_address_text,
        latitude, longitude, source_event_id,
        active, created_by, updated_by, deactivated_at
      )
      values (
        v_alias_text, v_original_address, v_alias_normalized,
        v_municipality_id, v_country_code,
        trim(r.venue_name), nullif(trim(r.address_text),''),
        r.latitude, r.longitude, r.sample_event_id,
        true, 'admin', 'admin', null
      )
      returning id into v_mapping_id;
    else
      update meets_private.location_alias_mappings
      set alias_text = v_alias_text,
          original_address_text = coalesce(original_address_text, v_original_address),
          canonical_venue_name = trim(r.venue_name),
          canonical_address_text = nullif(trim(r.address_text),''),
          latitude = r.latitude,
          longitude = r.longitude,
          source_event_id = r.sample_event_id,
          active = true,
          updated_by = 'admin',
          deactivated_at = null,
          updated_at = now()
      where id = v_mapping_id;
    end if;

    update public.event_locations l
    set venue_name = trim(r.venue_name),
        address_raw = coalesce(nullif(trim(r.address_text),''), l.address_raw),
        address_normalized = coalesce(nullif(trim(r.address_text),''), l.address_normalized),
        venue_point = extensions.st_setsrid(extensions.st_makepoint(r.longitude, r.latitude), 4326)::extensions.geography,
        fallback_point = null,
        alternative_address = null,
        location_precision = 'venue',
        location_basis = 'saved admin mapping',
        location_source = 'admin mapping:' || v_mapping_id::text,
        verified_at = now(),
        location_note = 'Lokācija apstiprināta ar atkārtoti izmantojamu admin mappingu.',
        location_quality = 'verified_exact',
        location_review_reason = null,
        geocode_query = null,
        geocode_candidates = '[]'::jsonb,
        geocode_suggested_at = null
    where meets_private.normalize_location_alias(coalesce(nullif(trim(l.venue_name),''), nullif(trim(l.address_raw),''))) = v_alias_normalized
      and coalesce(l.municipality_id, l.source_municipality_id) is not distinct from v_municipality_id
      and l.country_code is not distinct from v_country_code;
    get diagnostics v_updated = row_count;
    v_total := v_total + v_updated;

    update meets_private.location_alias_mappings
    set apply_count = apply_count + v_updated,
        last_applied_at = case when v_updated > 0 then now() else last_applied_at end,
        updated_at = now()
    where id = v_mapping_id;

    raise notice '%: % locations', r.venue_name, v_updated;
  end loop;

  v_published := meets_private.auto_publish_verified_imports();
  raise notice 'locations updated: %, events published: %', v_total, v_published;
end
$migration$;
