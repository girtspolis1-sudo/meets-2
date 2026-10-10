# MEETS 2 — Weekly municipality calendar synchronization

Deployed to production Supabase on 2026-10-10.

## Scheduled imports

Postgres `pg_cron` schedules two named jobs:

- `meets-municipalities-weekly`: `0 3 * * 3` (Wednesday, 03:00 UTC).
- `meets-municipalities-weekly-worker`: `*/10 * * * *`; it returns immediately if no run is active.

Start: `meets_private.municipality_sync_start()`. Work: `meets_private.municipality_sync_tick(30)`. Both are protected internal PostgreSQL functions. Source list is taken from `public.sources` with non-null `municipality_id` and `meets_private.source_registry.source_format = 'tvp'`. Up to 12 paginated TVP calendar pages per source are retrieved via Supabase `pg_net`.

Do not invoke these routines from client code and do not expose private tables to the browser. The existing admin session / source-catalogue RPC is responsible for status display.

## Validation and safe fallback

1. Queue all source pages and collect events into `meets_private.municipality_sync_candidates`, not the public event catalogue.
2. Parse dates and times. Limit candidates to today through 3 months ahead.
3. Normalize title by collapsing whitespace, trimming and lowercasing. The staging key is `(run_id, source_id, event_date, title_key)`.
4. Before accepting each municipality separately, verify there are no failed/unfinished pages and that the unique candidate count is nonzero and **at least 50%** of the most recent successful backup count.
5. If collection fails or a source has fewer than 50% of the previous count, mark `fallback`, retain the previous two snapshot records and **leave existing events and their publication statuses unchanged**. Other municipalities can still succeed.
6. For accepted candidates, first match existing events on municipality source + normalized title + date; fall back to source URL. Preserve existing IDs, manually edited data and verified coordinates. Only genuinely new events are inserted as `pending_review`, with location verification required before publishing.
7. Store immutable JSON snapshots of every accepted source. Keep **only the last two successful snapshots** per source (initial October baseline counts as one). Old working/import-history tables older than 90 days are cleaned at the next launch; the two backups are not cleaned away.

This is a conservative, append-only catalog update: accepted source scans do not automatically delete older records, including deleted or modified events. Ended events remain hidden by the public catalogue's date filter. Manual review is still needed for source cancellations or material changes to existing event details.

## Admin overview

In **Admin → Datu avoti → Pašvaldību avoti**, each source displays:

- Last active data copy and its record count;
- How many successful backups exist (0–2);
- Last weekly import attempt and status (`accepted`, `fallback`, `running`);
- Number of newly added records and failure/threshold reason.

The status RPC is `meets_private.admin_source_visibility_catalog` exposed through the existing token-protected `public.meets_admin_source_visibility_catalog`.

## Monitoring SQL

```sql
select jobid, jobname, schedule, active
from cron.job where jobname like 'meets-municipalities-%';

select started_at, finished_at, state, source_count,
       accepted_count, fallback_count, added_count, message
from meets_private.municipality_sync_runs
order by started_at desc limit 10;

select s.domain, sr.state, sr.previous_count, sr.unique_count,
       sr.added_count, sr.matched_count, sr.detail, sr.finished_at
from meets_private.municipality_sync_source_runs sr
join public.sources s on s.id=sr.source_id
order by sr.finished_at desc nulls last limit 40;

select s.domain, count(*) as backups,
       max(b.created_at) as last_active_at
from meets_private.municipality_sync_backups b
join public.sources s on s.id=b.source_id
group by s.domain;
```

## Verification

On 2026-10-10 a real source run was completed for `adazunovads.lv`:
33 unique events, previous snapshot 34, 33 matched with existing records, **0 new duplicates** and 2 backups retained. Database-only simulated below-threshold and accepted-insert scenarios were also tested with explicit transaction rollback, leaving no test event records.

Review any failures in the source status cards before considering a batch complete. New unverified venues remain in `pending_review`.
