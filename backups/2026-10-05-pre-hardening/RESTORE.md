# MEETS 2 pre-hardening recovery checkpoint

Captured: 2026-10-05
Git commit: `b2d4bbf51fe50a65668cee19d9b9e280096f90b3`
Checkpoint branch: `checkpoint-2026-10-05-pre-hardening`
Backup branch: `backup-2026-10-05-pre-hardening`
Database snapshot schema: `meets_backup_20261005_1407`

## What is backed up

- public event/catalog tables and current data;
- municipalities, settlements, sources, competitions, import history and source links;
- reusable location mappings;
- source registry and applied refresh records;
- current Cron definitions;
- all current Supabase Edge Function source files plus version/hash manifest;
- database migration manifest.

Excluded intentionally:
- admin password hash;
- recovery-code hash;
- active admin sessions;
- integration credential rows;
- Vault secret values.

Therefore this is a **recoverable application/data checkpoint**, but not a complete off-platform disaster-recovery dump of every secret/auth record.

## Database restore

The snapshot tables live in `meets_backup_20261005_1407`.
Before restoring production tables, first stop import Cron jobs and take a fresh snapshot.
Restore should be performed in FK order and inside a transaction where practical:
1. municipalities / settlements / sources / competitions;
2. import_runs;
3. events;
4. occurrences / locations / categories / event_categories / event_sources / sports metadata / import_items;
5. private mapping/source-registry/refresh-applied records.

Generated `event_locations.map_point` is not stored in the snapshot; it is regenerated from `venue_point` / `fallback_point`.

## Schema restore

Canonical schema history is the Supabase migration chain listed in `database/migrations.json`.
The backup snapshot is data-oriented CTAS and does not preserve all constraints/triggers/indexes by itself.
Recreate schema from migrations first, then restore snapshot data.

## Edge Functions

Sources are under `edge-functions/<slug>/`.
Redeploy each function using the recorded `verify_jwt` setting from `edge-functions/manifest.json`.
Runtime secrets must be restored separately from the Supabase/Vercel secret stores.

## Cron

Use `cron/restore.sql` after required Vault entries exist.
The file stores only Vault secret names, not their values.

## Git rollback

Reset/redeploy the application from commit:
`b2d4bbf51fe50a65668cee19d9b9e280096f90b3`

The connector used for this checkpoint does not expose Git tag creation, so the exact commit SHA and dedicated checkpoint branch are the version-control anchor.
