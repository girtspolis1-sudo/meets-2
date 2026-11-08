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
- Organizer events are also shared by link: `/ielugums/[token]` (page) and `/sludinajums/[token]` (printable A4 flyer) read one event through `meets_shared_event(p_token)` (lib/shared-event-server.js). Private events (`visibility='private'`, status `private`) are never reviewed and never in the catalogue or on the map.

## Tournaments and team roles

- Sports tournaments: tables `meets_tournaments`, `meets_tournament_teams`, `meets_tournament_games`, `meets_tournament_scorers`. The rules (formats, schedule, tables, places, checks) are pure functions in `lib/tournament.js`, shared by `/api/tournaments`, the wizard `/registre-turnira`, the public page and the print sheets. Save a whole tournament only through `meets_tournament_save` (it keeps results of unchanged games).
- Public by link only: `/turniri/[token]` (published; `meets_shared_tournament`, youth tournaments hide results, coaches never shown), `/turniri/[token]/druka` (A4 sheets), court secretary `/rezultati/[token]` (`meets_scorer_tournament`, `meets_scorer_set_score`, limited to its court). Tournaments are not in the catalogue or on the map.
- Organizer roles: owner and admin manage the team; editor ("Rīkotājs") creates and manages; contributor ("Labotājs") edits existing events and tournaments but creates nothing; viewer reads. One event or tournament can be given to a person through an item invitation (`meets_item_access`). Check edit rights on one item with `meets_can_edit_item(kind, id, org)`, creating with `meets_org_can_edit`.

## Sessions and admin

- Read the signed-in session only through `lib/account-store.js` (`useAccountSession`, `freshSession`).
- Admin rights: account e-mail in `meets_private.admin_email_allowlist` → row in `public.admin_users`; checked by `meets_private.is_meets_admin()`. There is no public admin sign-in.

## Commands

- `npm test` — unit tests (node:test)
- `npm run build` — production build (CI runs both)
