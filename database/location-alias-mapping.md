# Location alias mapping

MEETS keeps reusable location corrections in the private table:

`meets_private.location_alias_mappings`

A mapping connects a raw imported alias such as `OC Ventspils` to a canonical venue, address and coordinate pair.

## Matching scope

Mappings are matched by:

1. normalized raw venue/address alias;
2. municipality when available;
3. country code when available.

This prevents a generic venue name in one municipality/country from silently changing a venue with the same name elsewhere.

## Admin flow

The admin **Mapping** view groups unresolved event locations by alias and context. Before saving, the UI shows the number of existing events affected.

Saving calls:

`public.meets_admin_save_location_mapping(...)`

The function:

- validates the MEETS admin session;
- stores or updates the private mapping;
- updates all currently matching event locations;
- marks those locations `verified_exact`;
- does **not** publish the events.

Publishing remains a separate review action.

## Future imports

The trigger:

`zz_apply_saved_location_mapping_before_write`

runs on `public.event_locations` writes. If an active mapping matches the imported alias/context, the trigger replaces the imported approximate location with the approved canonical venue/address/coordinates.

This keeps importers source-agnostic: municipality, sports and future sources all use the same correction layer without duplicating mapping logic in individual scrapers.

## Safety

- mapping tables are in `meets_private` and cannot be read directly by anon/authenticated roles;
- public mapping RPCs require a valid short-lived MEETS admin session token;
- coordinates are restricted to the configured Baltic map bounds;
- saving a mapping never changes event publication status;
- existing and future uses are traceable through `location_source = 'admin mapping:<mapping-id>'`.
