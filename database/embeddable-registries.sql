-- MEETS 2 · owner-managed event registries
-- Installed on production Supabase on 2026-10-24.
-- Idempotent table creation; policies must not be applied a second time without checking.
create table if not exists public.meets_embed_registries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 500),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters)='object' and octet_length(filters::text) <= 4000),
  included_event_ids uuid[] not null default '{}'::uuid[] check (cardinality(included_event_ids) <= 100),
  excluded_event_ids uuid[] not null default '{}'::uuid[] check (cardinality(excluded_event_ids) <= 100),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meets_embed_registries_owner_idx on public.meets_embed_registries(user_id,created_at desc);
alter table public.meets_embed_registries enable row level security;
revoke all on public.meets_embed_registries from anon;
grant select,insert,update,delete on public.meets_embed_registries to authenticated;
create policy "embed registries owner select" on public.meets_embed_registries for select to authenticated using ((select auth.uid())=user_id);
create policy "embed registries owner insert" on public.meets_embed_registries for insert to authenticated with check ((select auth.uid())=user_id);
create policy "embed registries owner update" on public.meets_embed_registries for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "embed registries owner delete" on public.meets_embed_registries for delete to authenticated using ((select auth.uid())=user_id);

-- Explicitly selected published fields only. UUID-specific access; do not expose user_id.
create or replace function public.meets_public_embed_registry(p_id uuid)
returns table(title text,description text,filters jsonb,included_event_ids uuid[],excluded_event_ids uuid[])
language sql stable security definer set search_path=''
as $$
 select r.title,r.description,r.filters,r.included_event_ids,r.excluded_event_ids
 from public.meets_embed_registries r
 where r.id=p_id and r.is_published=true limit 1
$$;
revoke all on function public.meets_public_embed_registry(uuid) from public;
grant execute on function public.meets_public_embed_registry(uuid) to anon,authenticated;
