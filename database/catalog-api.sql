-- Token-gated, read-only catalogue for the Vercel server.
-- Replace __TOKEN_SHA256__ during provisioning; never commit the token.
-- Existing table grants, RLS, admin functions and event records are unchanged.
begin;
create or replace function meets_private.read_public_catalog(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if p_token is null or encode(extensions.digest(p_token,'sha256'),'hex') <> '__TOKEN_SHA256__' then
   raise exception 'Unauthorized' using errcode='42501';
 end if;
 return jsonb_build_object('fetchedAt',now(),'events',(
 select coalesce(jsonb_agg(to_jsonb(catalog) order by catalog.date_from,catalog.id),'[]'::jsonb)
 from (
 select v.id,v.title,v.description,v.date_from,v.date_to,v.time_from,v.time_to,v.timezone,
 v.schedule_type,v.time_type,v.attendance_mode,v.record_type,v.event_type,v.primary_category,
 v.status,v.review_status,v.price_status,v.price_text,v.price_min,v.price_max,v.currency,v.terms,
 v.venue_name,v.address_raw,v.alternative_address,v.location_precision,v.location_note,
 v.municipality,v.settlement,v.latitude,v.longitude,v.updated_at,
 (select coalesce(jsonb_agg(c.name order by c.name),'[]'::jsonb) from public.event_categories ec join public.categories c on c.id=ec.category_id where ec.event_id=v.id) as tags,
 (select coalesce(jsonb_agg(jsonb_build_object('source',s.domain,'url',es.source_url) order by es.id),'[]'::jsonb) from public.event_sources es join public.sources s on s.id=es.source_id where es.event_id=v.id) as sources
 from public.event_overview v
 where v.status = 'published'
 ) catalog));
end $$;
revoke all on function meets_private.read_public_catalog(text) from public,anon,authenticated;
grant execute on function meets_private.read_public_catalog(text) to anon;
create or replace function public.meets_public_catalog(p_token text) returns jsonb
language sql security invoker set search_path = '' as $$ select meets_private.read_public_catalog(p_token) $$;
revoke all on function public.meets_public_catalog(text) from public,anon,authenticated;
grant execute on function public.meets_public_catalog(text) to anon;
notify pgrst, 'reload schema';
commit;
