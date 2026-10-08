-- MEETS phase 1: pause verified youth competitions, retain data and review states.
-- Applied 2026-10-08. Requires catalog-api.sql active-competition filtering.
-- To reactivate LJBL: set active=true on the same competitions and sources.
-- The four athletics events must return to pending_review, never auto-published.
begin;
-- Import staging is internal; public access is through meets_public_catalog only.
revoke all on public.basketball_ljbl_import_ready_v from public, anon, authenticated;
update public.sports_competitions
set active=false, updated_at=now()
where competition_key like 'ljbl:%' and active=true;
update public.basketball_sources
set active=false, updated_at=now()
where section='LJBL' and basketball_level='youth' and active=true;
update public.events
set status='archived',
    notes='MEETS_PHASE1_YOUTH_DEFERRED_20261008; previous_status=pending_review; bērnu un jaunatnes sadaļa tiks aktivizēta vēlāk.',
    updated_at=now()
where status='pending_review' and notes is null and id in (
 '3476fbfe-3648-4d63-acce-d554766e9d7f',
 'e2dec8c7-c39a-4af1-901f-fdaea38ad04e',
 'ace61b7c-94ec-4b16-ae73-184a7f3a462b',
 '63be45eb-2d47-4874-9a7b-7cea8b0ade7a'
);
commit;
