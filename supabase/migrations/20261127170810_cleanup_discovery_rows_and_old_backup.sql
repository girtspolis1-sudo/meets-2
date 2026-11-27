-- Unused data (DB load review, round 2, part 5; decided by the owner).
--
-- public.basketball_discovery_items held 12 194 rows (43 MB) of a hand-run discovery
-- dry run, read once since 22 November. The table, the view
-- basketball_ljbl_import_ready_v and meets_private.import_ljbl_batch() stay, so the
-- dry run (Edge Function basketball-discovery-dry-run) can fill it again when needed.
truncate table public.basketball_discovery_items;

-- Backup of 5 October (18 tables, 3.3 MB). Nothing in the database or the repository
-- refers to it, and the data have changed a lot since then.
drop schema if exists meets_backup_20261005_1407 cascade;
