-- Public venue and organizer pages for sitemap.xml: only what is already public
-- (is_public), with the last change date. Called by the site server with the
-- publishable key, like the other meets_public_* reads.
create or replace function public.meets_public_sitemap_entries()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'venues',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'updated_at',v.created_at) order by v.name),'[]'::jsonb)
                from public.meets_venues v where v.is_public),
    'organizers',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'slug',o.slug,'updated_at',coalesce(o.updated_at,o.created_at)) order by o.name),'[]'::jsonb)
                    from public.meets_organizations o where o.is_public))
$$;
revoke all on function public.meets_public_sitemap_entries() from public;
grant execute on function public.meets_public_sitemap_entries() to anon,authenticated,service_role;
