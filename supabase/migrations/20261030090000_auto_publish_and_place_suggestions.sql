-- MEETS 2: publish verified imports automatically; address suggestions for any place.

-- Imported upcoming events from sources the admin keeps visible are published as soon as
-- their exact location is verified (the same rule as the admin "Publicēt" button, enforced
-- again by the enforce_publish_quality trigger).
create or replace function meets_private.auto_publish_verified_imports()
returns integer
language sql
security definer
set search_path = ''
as $$
  with published as (
    update public.events e
    set status = 'published', updated_at = now()
    where e.status = 'pending_review'
      and e.import_key is not null
      and coalesce(e.date_to, e.date_from) >= (now() at time zone 'Europe/Riga')::date
      and exists (
        select 1 from public.event_locations l
        where l.event_id = e.id
          and l.location_quality = 'verified_exact'
          and l.venue_point is not null
          and l.verified_at is not null
      )
      and not exists (
        select 1 from public.event_sources es join public.sources s on s.id = es.source_id
        where es.event_id = e.id and s.map_visible is false
      )
    returning 1
  )
  select count(*)::integer from published
$$;
revoke all on function meets_private.auto_publish_verified_imports() from public, anon, authenticated;

select cron.schedule('meets-auto-publish-verified', '25 * * * *', 'select meets_private.auto_publish_verified_imports();');

-- Stores geocoder suggestions for every unverified event at a place (the older
-- admin_store_location_candidates only covered LFF stadiums). Nothing is verified
-- until the admin accepts a suggestion as a location mapping.
create or replace function meets_private.admin_store_place_candidates(p_session_token text, p_venue_name text, p_query text, p_candidates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_candidates,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_candidates,'[]'::jsonb)) > 8 then
    raise exception 'Candidates must be an array of up to 8 places' using errcode='22023';
  end if;

  update public.event_locations l
     set geocode_query = left(p_query, 300),
         geocode_candidates = coalesce(p_candidates,'[]'::jsonb),
         geocode_suggested_at = now()
   where l.venue_name = p_venue_name
     and l.verified_at is null;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok',true,'updated',v_count);
end
$$;
revoke all on function meets_private.admin_store_place_candidates(text,text,text,jsonb) from public, anon, authenticated;

create or replace function public.meets_admin_store_place_candidates(p_session_token text, p_venue_name text, p_query text, p_candidates jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select meets_private.admin_store_place_candidates(p_session_token, p_venue_name, p_query, p_candidates) $$;
revoke all on function public.meets_admin_store_place_candidates(text,text,text,jsonb) from public;
grant execute on function public.meets_admin_store_place_candidates(text,text,text,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
