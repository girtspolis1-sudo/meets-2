# MEETS 2

Public event discovery application built with Next.js App Router, Supabase and Vercel.

## Current production architecture

- **Frontend:** Next.js 16 / React 19.
- **Hosting:** Vercel, deployed from GitHub `main`.
- **Data:** Supabase through a server-side public catalogue boundary.
- **Map:** Leaflet + MapLibre GL + OpenFreeMap.
- **Exports:** ExcelJS.
- **Runtime:** Node 24.x.

The public application exposes only `status = published` events, excludes ended events and limits the catalogue to a rolling window from today through three months ahead.

## Public experience

Implemented:

- interactive Baltic event map;
- location search and explicit browser geolocation;
- default location around Mārupe;
- 5 / 10 / 25 / 50 km or full-map radius;
- 3 days / this week / this month / manual date period;
- filters for event type, competition, category, country and municipality;
- event list with search, sorting, pagination and details;
- XLSX export;
- LFF, athletics, basketball and municipality events;
- Latvia, Estonia and Lithuania map support where source data is available;
- dedicated admin review and location-quality workflows.

The map has one implementation under `/karte`. The list page `/pasakumi` does not maintain a second map renderer.

## Public data boundary

The web app reads through the intentionally public read-only RPC:

`public.meets_public_catalog()`

The RPC returns only explicitly selected public fields. Anonymous users do not have direct `SELECT` access to the underlying event tables/views.

The Next.js server additionally:

1. keeps only `published` events;
2. applies the active three-month window;
3. projects every event through the public field allowlist before returning it to the browser.

Internal comments, review fields, import payloads, admin sessions and change history are not exposed through the public catalogue.

Required environment variables:

```text
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
```

Never expose a Supabase `service_role` key in browser code.

## Map runtime dependencies

Leaflet, MapLibre GL and the Leaflet/MapLibre adapter are installed as pinned npm dependencies and bundled by Next.js.

The application no longer downloads these JavaScript/CSS libraries from `unpkg.com` at runtime.

OpenFreeMap styles/tiles and OpenStreetMap-derived map data remain external map services by design; only the application libraries are localized into the build.

## Error monitoring

MEETS uses the built-in Next.js instrumentation hook and Vercel runtime logs:

- `instrumentation.js` records unhandled server request/render errors as structured JSON;
- `app/error.jsx` handles route-level render failures;
- `app/global-error.jsx` handles root-layout failures;
- `/api/client-error` forwards sanitized client render failures to server logs;
- `/api/health` logs degraded catalogue checks without leaking upstream responses or credentials.

Search Vercel production logs for:

```text
next_request_error
client_render_error
health_check_failed
```

Only sanitized message, route/digest and deployment metadata are recorded. Request headers, tokens and stack payloads are intentionally not forwarded by the custom logger.

## Data quality

Repeatable production checks are stored in:

`database/data-quality-audit.sql`

The audit covers:

- missing coordinates;
- unresolved LFF venues;
- suspicious location text;
- exact duplicate candidates;
- municipality spelling/coverage;
- Baltic basketball location precision.

Latvian imported sports events also use a durable locality → municipality normalization rule stored in:

`database/location-municipality-normalization.sql`

## Local development

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Tests and CI

Run deterministic tests:

```bash
npm test
```

To include the live Supabase integration checks locally, provide the production-compatible public environment variables before running the tests.

GitHub Actions runs on pull requests and `main`:

1. `npm ci`
2. `npm test`
3. `npm run build`

A change should be merged only after the `test-and-build` job is green.

## Production notes

- Search indexing is intentionally disabled until public launch sign-off.
- Browser favicon uses the compact MEETS `ee` mark; the full wordmark remains in the header/footer.
- Public pages use the same published catalogue source.
- Runtime map JS/CSS is bundled locally; map tiles remain external.
- The next launch checks are final 390 px visual verification, custom domain/SEO activation and final source/data review.
