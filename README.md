# meets 2

New, separate customer-facing Next.js project. Technical project/repository name: `meets-2`; display name: `meets 2`.

## Current scope

- Next.js App Router, React, responsive Latvian interface.
- Home page plus `/karte` and `/pasakumi` route foundations.
- Honest preparation states: map, event loading, filters and Excel export are **not yet implemented**.
- `/api/health` checks the application only, not database connectivity.
- Existing admin/demo application is separate and unchanged.

## Existing database

Use the existing Supabase **MEETS 2** project. Do not create a second database. No database mutations were made for this scaffold.

`.env.example` documents future server-side configuration. The app does not yet query Supabase. No keys or admin integration tokens are included. Before enabling public data, define approved-event access and return only public event fields; exclude comments, import payloads and internal review data. Do not reuse the unrestricted admin feed for public clients.

## Setup and deployment

1. GitHub repository: `girtspolis1-sudo/meets-2`, branch `main`. The repository is public; never commit credentials, event snapshots or internal admin data.
2. Import it into Vercel as `meets-2`, framework **Next.js**, Node.js **24.x**.
3. Build: `npm ci` then `npm run build` (configured in `vercel.json`).
4. Link the local/cloud checkout to that Vercel project before starting a dev server; verify environment configuration before database integration.
5. Production start: `npm start`; development: `npm run dev`.

Next.js is the application framework, so no separate Next.js account or cloud project is required.

Search-engine indexing is disabled during this setup phase. Enable it deliberately after public launch. Custom domain, billing upgrades and public database access are not configured by this starter.

## Next implementation stage

1. Public, read-only Supabase integration for approved events.
2. Map, honest location precision and shared date/category/municipality filters.
3. Event list with all-filtered-results `.xlsx` export.
4. Mobile/tablet/desktop verification and deployment checks.
5. Later: iframe views with client-specific stored filters.
