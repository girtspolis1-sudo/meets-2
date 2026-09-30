# MEETS 2

Customer-facing Next.js App Router application deployed from GitHub `main` to Vercel.

## Implemented

- Public event catalogue and interactive Baltic map.
- Only `status = published` events are exposed publicly.
- Server enforces a rolling window from today through three months ahead and excludes ended events.
- Map filters: location, 5/10/25/50 km or full map, 3 days / this week / this month / manual dates, event type, competition, category, country and municipality.
- Location defaults to Mārupe (Mārupes municipal administration area); browser geolocation is requested only after the user explicitly presses the location button.
- Search, list filters, sorting, pagination, event details and XLSX export.
- Admin review, publication and location-quality workflows, including LFF venues without a confirmed map point.
- `/api/health` verifies the live catalogue feed.

## Public data boundary

The public web app reads through one intentionally public, read-only RPC: `public.meets_public_catalog()`.

The RPC is a narrowly scoped `SECURITY DEFINER` endpoint that returns only explicitly selected public event fields and only `published` events. Anonymous users have no direct `SELECT` access to the underlying event tables/views. The Next.js server applies a second explicit field allowlist and repeats the published/date-window checks before returning data to the browser.

Internal comments, review data, import payloads, admin sessions and change history are not returned by the public RPC.

The legacy private token-gated catalogue helper is not part of the public application contract and must not be executable by `anon` or `authenticated`.

## Run

Node 24.x.

```bash
npm ci
npm run build
npm start
```

Required environment values:

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
```

No `service_role`/secret database key belongs in browser code.

## Tests

Live integration tests verify:

- only published rows reach the public application;
- public field projection excludes internal data;
- filters and date overlap behavior;
- Excel export and formula-injection safety;
- public RPC availability;
- direct anonymous table access remains denied.

Run:

```bash
node --conditions=react-server --env-file=.env.local --test tests/catalog.test.js
```

## Before public launch

- complete and verify 390 px mobile checks;
- keep search indexing disabled until final production sign-off;
- add CI so tests/build gate production deploys;
- complete final data-quality review and custom domain/SEO work.
