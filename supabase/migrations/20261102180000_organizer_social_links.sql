-- Organizers can list their social profiles (Facebook, Instagram, TikTok,
-- YouTube, X, LinkedIn). They are shown on the public organizer page.

alter table public.meets_organizations
  add column if not exists social_links jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.meets_organizations add constraint meets_organizations_social_links_check
    check (jsonb_typeof(social_links)='array' and jsonb_array_length(social_links)<=12);
exception when duplicate_object then null; end $$;

-- Only known networks and https links on the network's own site are kept.
create or replace function public.meets_update_organization_socials(p_organization_id uuid, p_links jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_links jsonb;
begin
  if not public.meets_org_can_edit(p_organization_id) then
    raise exception 'Nav tiesību' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('network',x.network,'url',x.url) order by x.ord),'[]'::jsonb)
    into v_links
    from (
      select distinct on (l->>'network') l->>'network' as network, left(l->>'url',500) as url,
             array_position(array['facebook','instagram','tiktok','youtube','x','linkedin'],l->>'network') as ord
        from jsonb_array_elements(case when jsonb_typeof(p_links)='array' then p_links else '[]'::jsonb end) l
       where l->>'network' = any(array['facebook','instagram','tiktok','youtube','x','linkedin'])
         and (l->>'url') ~* ('^https://([a-z0-9-]+\.)*('||case l->>'network'
               when 'facebook' then 'facebook\.com|fb\.com'
               when 'instagram' then 'instagram\.com'
               when 'tiktok' then 'tiktok\.com'
               when 'youtube' then 'youtube\.com|youtu\.be'
               when 'x' then 'x\.com|twitter\.com'
               when 'linkedin' then 'linkedin\.com' end||')(/|$)')
    ) x;
  update public.meets_organizations set social_links=v_links, updated_at=now() where id=p_organization_id;
  return v_links;
end
$function$;

revoke all on function public.meets_update_organization_socials(uuid,jsonb) from public, anon;
grant execute on function public.meets_update_organization_socials(uuid,jsonb) to authenticated;

create or replace function public.meets_public_organizer_profile(p_organization_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
 select jsonb_build_object(
   'organization',jsonb_build_object(
      'id',o.id,'name',o.name,'description',o.description,'image_url',o.image_url,
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
