-- MEETS 2: account-scoped venue follows for externally imported public events.
-- No change to the organizer-venue follows or event ingestion schema.
create table if not exists public.meets_user_location_follows (
 user_id uuid not null references auth.users(id) on delete cascade,
 location_key text not null check (length(location_key) between 6 and 450),
 location_name text not null check (length(location_name) between 3 and 160),
 municipality text not null check (length(municipality) between 1 and 140),
 created_at timestamptz not null default now(),
 primary key (user_id,location_key)
);
create index if not exists meets_user_location_follows_location_key_idx
 on public.meets_user_location_follows(location_key);
alter table public.meets_user_location_follows enable row level security;
drop policy if exists "account reads own followed locations" on public.meets_user_location_follows;
create policy "account reads own followed locations" on public.meets_user_location_follows
 for select to authenticated using (auth.uid()=user_id);
drop policy if exists "account follows locations" on public.meets_user_location_follows;
create policy "account follows locations" on public.meets_user_location_follows
 for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "account unfollows locations" on public.meets_user_location_follows;
create policy "account unfollows locations" on public.meets_user_location_follows
 for delete to authenticated using (auth.uid()=user_id);
grant select,insert,delete on public.meets_user_location_follows to authenticated;

-- Public event discovery remains anonymous; personal subscriptions do not.
revoke all on public.meets_user_location_follows from anon, public;
grant select, insert, delete on public.meets_user_location_follows to authenticated;
