# meets 2

Customer-facing Next.js App Router application, deployed from GitHub `main` to Vercel `meets-2`.

## Implemented

- Latvian responsive event list at `/pasakumi`: only status = published, per the updated production brief. Historical published events remain available in the list.
- Search, municipality/category/date/status/price filters, sorting, 50-row pagination, mobile cards, event details.
- `.xlsx` export of the complete filtered result, with 33 event fields, native date cells and an information sheet. Values are stored as strings, never formulas.
- `/api/events` reads the existing Supabase project on every request, without persistent event caching. The visible client refreshes every 60 seconds and offers manual refresh. This reads the database; it does not crawl source websites.
- `/api/health` checks the actual database feed.
- The map remains a preparation page. Existing admin/demo app is separate.

## Data boundary

`database/catalog-api.sql` documents the provisioned, token-gated read function. It returns only explicitly selected event information. The server applies a second allowlist. The database function and server both filter status = published. No anonymous table grants or write permissions were added. RLS and existing admin functions are unchanged. Internal comments, import payloads, notes and change history are not in the public feed.

`MEETS_CATALOG_TOKEN` is a dedicated server-only credential, stored as a SHA-256 verifier in a private-schema function. Never prefix it with `NEXT_PUBLIC_`, commit it, or expose it in responses. The SQL template needs a securely generated token hash when provisioning a new installation; it is not a command to rerun without securely supplying the existing verifier.

## Run

Node 24.x. Install with `npm ci`. Copy `.env.example` to `.env.local` and provision the three values through Vercel project settings. Production values are scoped to Production. `npm run build`, then `npm start`. `npm run dev` for development after configuration. Never commit runtime credentials or event snapshots.

Tests: `node --conditions=react-server --env-file=.env.local --test tests/catalog.test.js`. The live integration test checks that all returned rows are published. It also verifies filters, projection, native Excel dates, formula-like text, full exports and rejection of invalid credentials/direct anonymous table access.

## Remaining

Interactive map, richer location filtering, client-specific iframe views, custom domain and search indexing. Indexing remains disabled while the broader platform is in development.
