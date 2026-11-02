# meets.lv (meets-2)

Next.js 16 App Router + React 19 (plain JavaScript), Supabase (project `MEETS 2`, ref `qplvmhtwkjiyjmgpjzzz`), deployed to Vercel from `main`. UI copy is in Latvian.

## Database changes

- Every schema or data change goes into a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_short_name.sql` (unique version, later than the last one) and is applied with `supabase db push` or `apply_migration` using the same version and name.
- Never run DDL directly in the SQL editor or with `execute_sql` without the matching migration file: the database must stay reproducible from git.
- `database/` holds reference queries and notes, not migrations.
- To re-sync history with the live project, run the **DB migration history** workflow (Actions tab).

## Public data

- Browser code reads events through `/api/events` (light list form, `lib/catalog-wire.js`) and `/api/events/[id]` (full record). Never call `meets_public_catalog` from the browser.
- New public event fields must be added to `PUBLIC_FIELDS` (lib/catalog.js) and, if the list needs them, to `LIST_FIELDS` (lib/catalog-wire.js).

## Sessions and admin

- Read the signed-in session only through `lib/account-store.js` (`useAccountSession`, `freshSession`).
- Admin rights: account e-mail in `meets_private.admin_email_allowlist` → row in `public.admin_users`; checked by `meets_private.is_meets_admin()`. There is no public admin sign-in.

## Commands

- `npm test` — unit tests (node:test)
- `npm run build` — production build (CI runs both)
