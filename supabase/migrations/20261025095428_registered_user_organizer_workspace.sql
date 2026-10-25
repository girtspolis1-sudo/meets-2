-- Registered-user / organizer workspace evolution.
-- Additive and backwards compatible: existing ids and ownership stay unchanged.

alter table public.meets_organizations
  add column if not exists description text not null default '',
  add column if not exists image_url text,
  add column if not exists public_email text,
  add column if not exists public_phone text,
  add column if not exists public_url text,
  add column if not exists is_public boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Drafts may be incomplete. Any non-draft still requires a date.
alter table public.meets_submissions alter column date_from drop not null;
alter table public.meets_submissions
  drop constraint if exists meets_submissions_date_required_when_submitted;
alter table public.meets_submissions
  add constraint meets_submissions_date_required_when_submitted
  check (status = 'draft' or date_from is not null);

-- A list can remain personal or explicitly belong to an organization.
alter table public.meets_embed_registries
  add column if not exists organization_id uuid references public.meets_organizations(id) on delete cascade;

create index if not exists meets_embed_registries_organization_id_idx
  on public.meets_embed_registries(organization_id);

drop policy if exists "embed registries owner select" on public.meets_embed_registries;
drop policy if exists "embed registries owner insert" on public.meets_embed_registries;
drop policy if exists "embed registries owner update" on public.meets_embed_registries;
drop policy if exists "embed registries owner delete" on public.meets_embed_registries;

create policy "embed registries scoped select"
on public.meets_embed_registries for select to authenticated
using (
  (organization_id is null and (select auth.uid()) = user_id)
  or (organization_id is not null and public.meets_org_can_read(organization_id))
);

create policy "embed registries scoped insert"
on public.meets_embed_registries for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    organization_id is null
    or public.meets_org_can_edit(organization_id)
  )
);

create policy "embed registries scoped update"
on public.meets_embed_registries for update to authenticated
using (
  (organization_id is null and (select auth.uid()) = user_id)
  or (organization_id is not null and public.meets_org_can_edit(organization_id))
)
with check (
  (organization_id is null and (select auth.uid()) = user_id)
  or (organization_id is not null and public.meets_org_can_edit(organization_id))
);

create policy "embed registries scoped delete"
on public.meets_embed_registries for delete to authenticated
using (
  (organization_id is null and (select auth.uid()) = user_id)
  or (organization_id is not null and public.meets_org_can_edit(organization_id))
);

-- Keep the venue owner/manager unchanged while allowing other organizations
-- to reference a public venue without acquiring edit rights.
create table if not exists public.meets_organization_venues (
  organization_id uuid not null references public.meets_organizations(id) on delete cascade,
  venue_id uuid not null references public.meets_venues(id) on delete cascade,
  relation_type text not null default 'used' check (relation_type in ('managed','used')),
  created_at timestamptz not null default now(),
  primary key (organization_id, venue_id)
);

alter table public.meets_organization_venues enable row level security;

insert into public.meets_organization_venues(organization_id, venue_id, relation_type)
select v.organization_id, v.id, 'managed'
from public.meets_venues v
on conflict (organization_id, venue_id) do update set relation_type='managed';

drop policy if exists "organization venue links read" on public.meets_organization_venues;
drop policy if exists "organization venue links edit insert" on public.meets_organization_venues;
drop policy if exists "organization venue links edit update" on public.meets_organization_venues;
drop policy if exists "organization venue links edit delete" on public.meets_organization_venues;

create policy "organization venue links read"
on public.meets_organization_venues for select to authenticated
using (public.meets_org_can_read(organization_id));

create policy "organization venue links edit insert"
on public.meets_organization_venues for insert to authenticated
with check (public.meets_org_can_edit(organization_id));

create policy "organization venue links edit update"
on public.meets_organization_venues for update to authenticated
using (public.meets_org_can_edit(organization_id))
with check (public.meets_org_can_edit(organization_id));

create policy "organization venue links edit delete"
on public.meets_organization_venues for delete to authenticated
using (public.meets_org_can_edit(organization_id));

-- Public venues are discoverable, but this policy grants no update rights.
drop policy if exists "venues public read" on public.meets_venues;
create policy "venues public read"
on public.meets_venues for select to anon, authenticated
using (is_public = true);

-- Profile writes go through a narrow RPC so owner_id/id cannot be reassigned.
create or replace function public.meets_update_organization_profile(
  p_organization_id uuid,
  p_name text,
  p_description text default '',
  p_image_url text default null,
  p_public_email text default null,
  p_public_phone text default null,
  p_public_url text default null,
  p_is_public boolean default false
)
returns public.meets_organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.meets_organizations;
begin
  if not public.meets_org_can_edit(p_organization_id) then
    raise exception 'Nav tiesību';
  end if;
  if char_length(trim(coalesce(p_name,''))) < 2 or char_length(trim(p_name)) > 160 then
    raise exception 'Nederīgs organizatora nosaukums';
  end if;
  update public.meets_organizations
  set name = trim(p_name),
      description = left(coalesce(p_description,''), 2000),
      image_url = nullif(left(trim(coalesce(p_image_url,'')), 1000),''),
      public_email = nullif(left(trim(coalesce(p_public_email,'')), 254),''),
      public_phone = nullif(left(trim(coalesce(p_public_phone,'')), 80),''),
      public_url = nullif(left(trim(coalesce(p_public_url,'')), 1000),''),
      is_public = coalesce(p_is_public,false),
      updated_at = now()
  where id = p_organization_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.meets_update_organization_profile(uuid,text,text,text,text,text,text,boolean) from public;
grant execute on function public.meets_update_organization_profile(uuid,text,text,text,text,text,text,boolean) to authenticated;

-- Public profile exposes only public organization fields and published events.
create or replace function public.meets_public_organizer_profile(p_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organization', jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'description', o.description,
      'image_url', o.image_url,
      'public_email', o.public_email,
      'public_phone', o.public_phone,
      'public_url', o.public_url
    ),
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',v.id,'name',v.name,'address',v.address,'description',v.description,
        'latitude',v.latitude,'longitude',v.longitude
      ) order by v.name)
      from public.meets_venues v
      where v.organization_id=o.id and v.is_public=true
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.event_id,'submission_id',s.id,'title',s.title,'description',s.description,
        'category',s.category,'date_from',s.date_from,'date_to',s.date_to,
        'time_from',s.time_from,'time_to',s.time_to,'venue_id',s.venue_id,
        'venue_name',s.venue_name,'address',s.address,'price_status',s.price_status,
        'price_min',s.price_min,'price_max',s.price_max
      ) order by s.date_from nulls last, s.time_from nulls last)
      from public.meets_submissions s
      where s.organization_id=o.id
        and s.status='published'
        and s.event_id is not null
        and coalesce(s.date_to,s.date_from) >= (now() at time zone 'Europe/Riga')::date
    ), '[]'::jsonb)
  )
  from public.meets_organizations o
  where o.id=p_organization_id
    and (
      o.is_public=true
      or exists (
        select 1 from public.meets_submissions s
        where s.organization_id=o.id and s.status='published' and s.event_id is not null
      )
    )
$$;

revoke all on function public.meets_public_organizer_profile(uuid) from public;
grant execute on function public.meets_public_organizer_profile(uuid) to anon, authenticated;

comment on table public.meets_organization_venues is
'Organization relationship to a venue. managed means the venue owner; used means the organization only references a public venue.';
