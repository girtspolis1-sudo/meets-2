-- LFF import: the last match row on a page absorbed the top-scorers table into
-- venue_name/address_raw ("Jaunmārupes stadions 1 Artjoms Deņisovs ... 5 2 ...").
-- Parser fixed in sync-lff-events (cleanVenue).

-- 1) An admin alias mapping was saved with the polluted text as its canonical name
--    (and LFF's office address), so the location trigger kept re-applying it.
--    Retire such mappings first, otherwise the update below is undone by the trigger.
update meets_private.location_alias_mappings
set active = false, updated_at = now()
where active and length(canonical_venue_name) > 150;

-- 2) Cut the text where the ranked scorers list starts.
update public.event_locations
set venue_name = trim(regexp_replace(venue_name, '\s1\s+[[:upper:]]\S+\s+[[:upper:]]\S+.*$', '')),
    address_raw = case
      when address_raw ~ '\s1\s+[[:upper:]]\S+\s+[[:upper:]]\S+.*\s\d+\s+2\s+[[:upper:]]'
        or address_raw like 'Emiļa Melngaiļa iela 1A%'
      then trim(regexp_replace(venue_name, '\s1\s+[[:upper:]]\S+\s+[[:upper:]]\S+.*$', ''))
      else address_raw end,
    location_source = case when location_source like 'admin mapping:%' then null else location_source end
where venue_name ~ '\s1\s+[[:upper:]]\S+\s+[[:upper:]]\S+.*\s\d+\s+2\s+[[:upper:]]'
  and length(venue_name) > 150;
