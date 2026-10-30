-- 1. A saved address mapping also applies to events whose country is not given
--    (league imports leave it empty); 182 basketball events at 13 places were
--    waiting only because of that.
-- 2. A known MEETS place is suggested only when the names really agree: the same
--    numbers ("Rīgas 47.vsk." is not "Rīgas 49.vsk.") and every word, with
--    abbreviations expanded ("Ķekavas vsk." is not "Ķekavas SK").

-- Every word (as a stem) and every number of the name appears in the candidate.
create or replace function meets_private.place_names_match(p_name text, p_candidate text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  with candidate as (
    select ' '||meets_private.plain_text(meets_private.place_search_query(p_candidate,null))||' ' t
  )
  select coalesce(bool_and(case
           when w ~ '^[0-9]+$' then position(' '||w||' ' in (select t from candidate))>0
           else position(left(w,greatest(4,length(w)-2)) in (select t from candidate))>0 end),false)
    from regexp_split_to_table(meets_private.plain_text(meets_private.place_search_query(p_name,null)),' ') w
   where w ~ '^[0-9]+$' or length(w)>3
$$;

create or replace function meets_private.apply_saved_location_mapping_before_write()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_alias_text text;
  v_alias_normalized text;
  v_municipality_id bigint;
  v_mapping meets_private.location_alias_mappings%rowtype;
  v_old_mapping_id uuid;
begin
  if tg_op='UPDATE'
     and coalesce(old.location_source,'') like 'admin mapping:%'
     and (
       new.location_source is not distinct from old.location_source
       or new.location_source is null
     )
  then
    begin
      v_old_mapping_id := replace(old.location_source,'admin mapping:','')::uuid;
    exception when others then
      v_old_mapping_id := null;
    end;

    if v_old_mapping_id is not null then
      select m.*
        into v_mapping
        from meets_private.location_alias_mappings m
       where m.id=v_old_mapping_id
         and m.active
       limit 1;
    end if;
  end if;

  if v_mapping.id is null then
    v_alias_text := coalesce(
      nullif(trim(new.venue_name),''),
      nullif(trim(new.address_raw),'')
    );

    if v_alias_text is null then
      return new;
    end if;

    v_alias_normalized := meets_private.normalize_location_alias(v_alias_text);
    if length(v_alias_normalized) < 3 then
      return new;
    end if;

    v_municipality_id := coalesce(new.municipality_id,new.source_municipality_id);

    -- An event without a country matches a mapping for any country; its municipality still has to agree.
    select m.*
      into v_mapping
      from meets_private.location_alias_mappings m
     where m.active
       and m.alias_normalized=v_alias_normalized
       and (m.municipality_id is null or m.municipality_id=v_municipality_id)
       and (m.country_code is null or new.country_code is null or m.country_code=new.country_code)
     order by
       case when m.municipality_id is not null then 1 else 0 end desc,
       case when m.country_code is not null then 1 else 0 end desc,
       m.updated_at desc
     limit 1;
  end if;

  if v_mapping.id is null then
    return new;
  end if;

  new.venue_name := v_mapping.canonical_venue_name;
  new.address_raw := coalesce(
    nullif(v_mapping.canonical_address_text,''),
    new.address_raw
  );
  new.address_normalized := coalesce(
    nullif(v_mapping.canonical_address_text,''),
    new.address_normalized
  );
  new.venue_point := extensions.st_setsrid(
    extensions.st_makepoint(v_mapping.longitude,v_mapping.latitude),
    4326
  )::extensions.geography;
  new.fallback_point := null;
  new.alternative_address := null;
  new.location_precision := 'venue';
  new.location_basis := 'saved admin mapping';
  new.location_source := 'admin mapping:'||v_mapping.id::text;
  new.verified_at := now();
  new.location_note := 'Lokācija automātiski piemērota no admin adreses mappinga.';
  new.location_quality := 'verified_exact';
  new.location_review_reason := null;
  new.geocode_query := null;
  new.geocode_candidates := '[]'::jsonb;
  new.geocode_suggested_at := null;
  new.country_code := coalesce(new.country_code,v_mapping.country_code);

  update meets_private.location_alias_mappings
     set apply_count=apply_count+1,
         last_applied_at=now()
   where id=v_mapping.id;

  return new;
end
$function$;

create or replace function meets_private.place_search_tick()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r record;
  v_response record;
  v_candidates jsonb;
  v_known jsonb;
  v_done integer := 0;
  v_sent boolean := false;
begin
  if not pg_try_advisory_xact_lock(201026,1131) then return jsonb_build_object('state','busy'); end if;

  -- 1. Answers to earlier searches.
  for r in select q.*,m.name municipality from meets_private.place_search_queue q
             left join public.municipalities m on m.id=q.municipality_id
            where q.state='requested' loop
    select status_code,content,error_msg into v_response from net._http_response where id=r.request_id;
    if not found then
      if r.requested_at<now()-interval '10 minutes' then
        update meets_private.place_search_queue
           set state=case when attempts>=3 then 'failed' else 'queued' end,error='Atbilde netika saņemta'
         where venue_name=r.venue_name;
      end if;
      continue;
    end if;
    v_candidates := null;
    if v_response.status_code=200 and v_response.content is not null then
      begin
        v_candidates := meets_private.place_search_candidates(v_response.content::jsonb,r.query,r.municipality);
      exception when others then v_candidates := null;
      end;
    end if;
    if v_candidates is null then
      update meets_private.place_search_queue
         set state=case when attempts>=3 then 'failed' else 'queued' end,
             error=left(coalesce(v_response.error_msg,'HTTP '||coalesce(v_response.status_code::text,'?')),300)
       where venue_name=r.venue_name;
    else
      perform meets_private.place_search_store(r.venue_name,r.query,v_candidates,'OpenStreetMap');
      v_done := v_done+1;
    end if;
  end loop;

  -- 2. Places MEETS already knows answer without an outside request.
  for r in select q.venue_name,m.name municipality from meets_private.place_search_queue q
             left join public.municipalities m on m.id=q.municipality_id
            where q.state='queued' and q.known_checked_at is null
            order by q.event_count desc,q.venue_name limit 20 loop
    select coalesce(jsonb_agg(x),'[]'::jsonb) into v_known
      from jsonb_array_elements(meets_private.match_known_places(r.venue_name,r.municipality)) x
     where (x->>'score')::numeric>=0.75 and coalesce((x->>'sameArea')::boolean,true)
       and meets_private.place_names_match(r.venue_name,(x->>'label')||' '||coalesce(x->>'displayName',''));
    if jsonb_array_length(v_known)>0 then
      perform meets_private.place_search_store(r.venue_name,'MEETS zināmās vietas',v_known,'MEETS');
      v_done := v_done+1;
    else
      update meets_private.place_search_queue set known_checked_at=now() where venue_name=r.venue_name;
    end if;
  end loop;

  -- 3. One OpenStreetMap search at a time (their usage policy allows one per second).
  if not exists(select 1 from meets_private.place_search_queue where state='requested') then
    select q.venue_name,q.query into r from meets_private.place_search_queue q
     where q.state='queued' and q.known_checked_at is not null
     order by q.attempts,q.event_count desc,q.venue_name limit 1;
    if found then
      update meets_private.place_search_queue
         set state='requested',attempts=attempts+1,requested_at=now(),
             request_id=net.http_get(
               url:='https://nominatim.openstreetmap.org/search',
               params:=jsonb_build_object('q',r.query,'format','jsonv2','limit','8','countrycodes','lv,ee,lt','accept-language','lv,en'),
               headers:=jsonb_build_object('User-Agent','MEETS/1.0 (+https://meets.lv; contact: girts.polis@icloud.com)','Accept','application/json'),
               timeout_milliseconds:=20000)
       where venue_name=r.venue_name;
      v_sent := true;
    end if;
  end if;
  return jsonb_build_object('stored',v_done,'sent',v_sent);
end
$$;

-- Known-place suggestions made before this check are looked at again.
update meets_private.place_search_queue
   set state='queued',attempts=0,known_checked_at=null,candidates=null,result_count=null
 where source='MEETS';

-- Re-run the location triggers for upcoming unverified events so saved mappings apply,
-- then publish the ones whose location is now verified.
do $$
declare v_event uuid;
begin
  for v_event in
    update public.event_locations l set venue_name=l.venue_name
      from public.events e
     where e.id=l.event_id and l.verified_at is null
       and e.status in ('pending_review','published')
       and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date
    returning l.event_id
  loop
    if exists(select 1 from public.event_locations where event_id=v_event and verified_at is not null) then
      perform meets_private.import_publish_if_ready(v_event);
    end if;
  end loop;
end
$$;
