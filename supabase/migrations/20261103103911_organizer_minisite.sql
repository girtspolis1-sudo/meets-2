-- Organizer mini-site: readable links (/organizatori/balvu-sporta-zale),
-- company requisites, and the public address point.

-- 1. Slug from the name (Latvian letters to ASCII), unique per organizer.
create or replace function public.meets_slugify(p_text text)
 returns text language sql immutable set search_path to ''
as $$
 select nullif(trim(both '-' from regexp_replace(
   translate(lower(coalesce(p_text,'')),'āčēģīķļņōŗšūžäöüõ','acegiklnorsuzaouo'),
   '[^a-z0-9]+','-','g')),'')
$$;

alter table public.meets_organizations add column if not exists slug text;

create or replace function public.meets_organizations_set_slug()
 returns trigger language plpgsql set search_path to ''
as $$
declare
 base text := coalesce(left(public.meets_slugify(new.name),60),'organizators');
 candidate text := base;
 n int := 1;
begin
 if tg_op='UPDATE' and new.name is not distinct from old.name and new.slug is not null then
  return new;
 end if;
 while exists(select 1 from public.meets_organizations o where o.slug=candidate and o.id<>new.id) loop
  n := n + 1;
  candidate := base||'-'||n;
 end loop;
 new.slug := candidate;
 return new;
end;
$$;

drop trigger if exists meets_organizations_slug on public.meets_organizations;
create trigger meets_organizations_slug before insert or update of name, slug on public.meets_organizations
 for each row execute function public.meets_organizations_set_slug();

-- Backfill existing organizers, oldest first so they keep the plain name.
do $$
declare r record;
begin
 for r in select id from public.meets_organizations where slug is null order by created_at, id loop
  update public.meets_organizations set slug = null where id = r.id;
 end loop;
end $$;

create unique index if not exists meets_organizations_slug_key on public.meets_organizations(slug);

-- 2. Requisites (rekvizīti), shown only when the organizer marks them public.
alter table public.meets_org_contact_details
 add column if not exists legal_name text,
 add column if not exists reg_number text,
 add column if not exists vat_number text,
 add column if not exists bank_name text,
 add column if not exists bank_account text,
 add column if not exists requisites_public boolean not null default false;

-- 3. Slug → id for the public page.
create or replace function public.meets_public_organizer_id(p_slug text)
 returns uuid language sql stable security definer set search_path to ''
as $$
 select o.id from public.meets_organizations o where o.slug=lower(p_slug) and o.is_public=true limit 1
$$;
grant execute on function public.meets_public_organizer_id(text) to anon, authenticated;

-- 4. Public profile now carries the slug.
create or replace function public.meets_public_organizer_profile(p_organization_id uuid)
 returns jsonb language sql stable security definer set search_path to ''
as $function$
 select jsonb_build_object(
   'organization',jsonb_build_object(
      'id',o.id,'slug',o.slug,'name',o.name,'description',o.description,'image_url',o.image_url,
      'public_email',null,'public_phone',null,
      'public_url',case when c.website_public=true then o.public_url else null end,
      'social_links',coalesce(o.social_links,'[]'::jsonb)
    ),
   'venues',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',v.id,'name',v.name,'address',v.address,'description',v.description,
        'latitude',v.latitude,'longitude',v.longitude
      ) order by v.name)
      from public.meets_venues v
      where v.organization_id=o.id and v.is_public=true
   ),'[]'::jsonb),
   'events',coalesce((
      select jsonb_agg(jsonb_build_object(
         'id',s.event_id,'submission_id',s.id,'title',s.title,'description',s.description,
         'category',s.category,'date_from',s.date_from,'date_to',s.date_to,
         'time_from',s.time_from,'time_to',s.time_to,'venue_id',s.venue_id,
         'venue_name',s.venue_name,'address',s.address,'price_status',s.price_status,
         'price_min',s.price_min,'price_max',s.price_max
      ) order by s.date_from nulls last,s.time_from nulls last)
      from public.meets_submissions s
      where s.organization_id=o.id and s.status='published' and s.event_id is not null
        and coalesce(s.date_to,s.date_from)>=(now() at time zone 'Europe/Riga')::date
   ),'[]'::jsonb)
 )
 from public.meets_organizations o
 left join public.meets_org_contact_details c on c.organization_id=o.id
 where o.id=p_organization_id and o.is_public=true;
$function$;

-- 5. Public contact details: contacts, address point and requisites, each only when public.
create or replace function public.meets_public_org_contact_details(p_org uuid)
 returns jsonb language sql stable security definer set search_path to ''
as $function$
 select jsonb_build_object(
  'address',case when c.address_public then c.address else '' end,
  'address_latitude',case when c.address_public then c.address_latitude end,
  'address_longitude',case when c.address_public then c.address_longitude end,
  'contacts',case when c.contacts_public then coalesce((select jsonb_agg(jsonb_build_object('type',x->>'type','label',x->>'label','value',x->>'value')) from jsonb_array_elements(c.contacts) x where x->>'public'='true'),'[]'::jsonb) else '[]'::jsonb end,
  'requisites',case when c.requisites_public then jsonb_strip_nulls(jsonb_build_object(
    'legal_name',nullif(c.legal_name,''),'reg_number',nullif(c.reg_number,''),'vat_number',nullif(c.vat_number,''),
    'bank_name',nullif(c.bank_name,''),'bank_account',nullif(c.bank_account,''))) end
 )
 from public.meets_org_contact_details c
 join public.meets_organizations o on o.id=c.organization_id
 where o.id=p_org and o.is_public=true
 limit 1;
$function$;
