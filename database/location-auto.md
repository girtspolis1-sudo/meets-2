# Automatic map points

Places without a verified map point are resolved automatically when an official
source gives exactly one answer. Anything doubtful stays in Admin → Mapping.

Migrations: `20261111090000_location_auto_reference.sql` (tables, matching, plan),
`20261111100000_location_auto_apply.sql` (trigger, run, revert, publishing, cron).

## Steps

| Step | Source | Applied when | Result |
|---|---|---|---|
| 1 `address_register` | `meets_private.address_register` (VZD) | the event text has one street address in the event's municipality, and names its town, village or parish (a city municipality needs no town) | `source_exact` / `exact_address`, `location_source = var:<kods>`, published |
| 2 `culture_institution` | `meets_private.culture_institutions` (data.gov.lv "Latvijas kultūras institūcijas", kulturasdati.lv) | exactly one institution of the municipality has the same name, word for word both ways, and the text names its town or parish | `source_exact` / `venue`, `location_source = kulturasdati:<ISIL>`, published |
| 3 `settlement_center` | `meets_private.place_centroids` (VZD "Vietu centroidi") | the name is only a town, village or parish of the municipality | `fallback_center` / `settlement_center`, `location_source = vzd-centroid:<kods>`, out of the queue, not published |
| 4 `source_page_address` | the event's source page → address register | off by default; one register address found on the page, nothing else found | `source_exact` / `exact_address`, stays in the queue, not published |

Coordinates only come from these tables. An institution's coordinates are used only
after `culture_institutions_check()` confirmed them against the address register
(300 m) or the centre of its town or village. Every point must lie inside the
Latvia polygon in `meets_private.country_borders`.

`verified_at` stays empty for automatic points: it means a person or a saved admin
mapping confirmed the place. Rows with `verified_at` are never touched, and a saved
mapping always wins (its trigger runs first).

## How it runs

- `meets_private.location_auto_plan()` — read only; one row per place (name key +
  municipality) with `decision` `apply`, `existing` or `manual` and the `reason`.
- `meets_private.location_auto_run(p_dry_run)` — saves resolved places in
  `meets_private.location_auto_places` and touches the waiting events. Cron
  `meets-location-auto`, hourly at :53.
- Trigger `zzz_apply_auto_location_before_write` on `public.event_locations` gives
  the saved point to every unverified event of that place, also at later imports,
  so one place has one point.
- Reference tables reload monthly (cron `meets-place-reference-monthly`, edge
  function `load-place-reference`).
- Step 4: `update meets_private.app_settings set value='on' where key='location_auto_source_pages';`
  (cron `meets-location-source-pages`, edge function `extract-source-addresses`).

## Dry run

```sql
select meets_private.location_auto_run(true);
select decision, method, count(*) places, sum(events) events
  from meets_private.location_auto_plan() group by 1,2 order by 1,2;
-- What stays manual, and why:
select reason, count(*) places, sum(events) events
  from meets_private.location_auto_plan() where decision='manual' group by 1 order by 3 desc;
```

## Undo

Every first application is logged in `meets_private.location_auto_log` with the
earlier point, precision, source, note and event status.

```sql
-- One place (find its id in meets_private.location_auto_places):
select meets_private.location_auto_revert(p_place_id => 123, p_note => 'wrong building');
-- Everything one step did:
select meets_private.location_auto_revert(p_method => 'culture_institution');
-- Everything:
select meets_private.location_auto_revert(p_all => true);
```

A revert restores the earlier values, returns events the automatic point had
published to review, and leaves the place blocked (`active = false`) so the next
run does not resolve it again. To let it be resolved again, delete its row from
`meets_private.location_auto_places` (its log rows first).

To stop everything without undoing: `select cron.unschedule('meets-location-auto');`
and `alter table public.event_locations disable trigger zzz_apply_auto_location_before_write;`.

## Checks

```sql
-- A Latvian point outside Latvia (expect 0):
select count(*) from public.event_locations l
 where coalesce(l.country_code,'LV')='LV' and l.location_auto_place_id is not null
   and not meets_private.point_in_country('LV',
         extensions.st_y(l.map_point::extensions.geometry),extensions.st_x(l.map_point::extensions.geometry));
-- A place with two points (expect 0):
select location_auto_place_id from public.event_locations where location_auto_place_id is not null
 group by 1 having count(distinct extensions.st_astext(map_point::extensions.geometry))>1;
```

Tests: `tests/sql/location-auto.test.sql` (CI job `location-sql-tests`),
`tests/place-reference.test.js`, `tests/source-address.test.js`.
