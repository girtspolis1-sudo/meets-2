-- Automatic map points, part 2: applying the plan of 20261111084937.
--
-- A resolved place is saved once in meets_private.location_auto_places; a trigger
-- gives its point to every unverified event with that name in that municipality,
-- now and at later imports, so one place always has one point. Rows with
-- verified_at and saved admin mappings are never touched (the mapping trigger
-- runs first and verifies the row). Each first application is written to
-- meets_private.location_auto_log; meets_private.location_auto_revert() undoes it.
--
--   address register / institution -> source_exact, removed from the admin queue,
--                                     imported events are published;
--   town or parish centre          -> fallback_center, removed from the queue, not published;
--   source page address            -> source_exact, stays in the queue for a look.

create or replace function meets_private.apply_auto_location_before_write()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_alias text;
  v_place meets_private.location_auto_places%rowtype;
  v_old_place bigint := case when tg_op='UPDATE' then old.location_auto_place_id end;
  v_match jsonb;
  v_ok boolean := false;
  v_prev public.event_locations%rowtype;
  v_point extensions.geography;
begin
  -- Verified by a person or a saved mapping: no longer an automatic point.
  if new.verified_at is not null then
    new.location_auto_place_id := null;
    return new;
  end if;

  v_alias := coalesce(nullif(btrim(new.venue_name),''),nullif(btrim(new.address_raw),''));
  if v_alias is not null and new.municipality_id is not null and coalesce(new.country_code,'LV')='LV' then
    select * into v_place from meets_private.location_auto_places p
     where p.place_key=meets_private.location_place_key(v_alias) and p.municipality_id=new.municipality_id and p.active;
    v_ok := found;
  end if;

  -- An event whose own text gives another (or an unclear) street address is not this place.
  if v_ok and v_place.method in ('address_register','source_page_address') then
    v_match := meets_private.location_auto_register_match(
      concat_ws(', ',v_alias,nullif(btrim(new.address_raw),v_alias),nullif(btrim(new.locality_text),'')),new.municipality_id);
    if v_match->>'status'='ambiguous'
       or (v_match->>'status' in ('match','unconfirmed') and 'var:'||(v_match->>'kods')<>v_place.source_ref) then
      v_ok := false;
    end if;
  end if;

  -- A venue point the import brought itself is left alone.
  if v_ok and new.venue_point is not null
     and not (v_old_place is not distinct from v_place.id and new.venue_point::text is not distinct from old.venue_point::text) then
    v_ok := false;
  end if;

  if not v_ok then
    if new.location_auto_place_id is not null then
      new.location_auto_place_id := null;
      -- The name or municipality changed and the old automatic point is still there: drop it.
      if tg_op='UPDATE' and v_old_place is not null
         and new.venue_point::text is not distinct from old.venue_point::text
         and new.fallback_point::text is not distinct from old.fallback_point::text then
        new.venue_point := null;
        new.fallback_point := null;
        new.location_precision := 'unresolved';
        new.location_quality := 'missing_point';
        new.location_basis := null;
        new.location_source := null;
        new.location_note := null;
        new.location_review_reason := 'Nav noteiktas izmantojamas kartes koordinātas.';
      end if;
    end if;
    return new;
  end if;

  if not meets_private.point_in_country('LV',v_place.latitude,v_place.longitude) then
    return new;
  end if;

  if tg_op='INSERT' or v_old_place is distinct from v_place.id then
    if tg_op='UPDATE' then v_prev := old; else v_prev := new; end if;
    insert into meets_private.location_auto_log(event_id,place_id,method,previous)
    values(new.event_id,v_place.id,v_place.method,jsonb_build_object(
      'venue_latitude',extensions.st_y(v_prev.venue_point::extensions.geometry),
      'venue_longitude',extensions.st_x(v_prev.venue_point::extensions.geometry),
      'fallback_latitude',extensions.st_y(v_prev.fallback_point::extensions.geometry),
      'fallback_longitude',extensions.st_x(v_prev.fallback_point::extensions.geometry),
      'location_precision',v_prev.location_precision,
      'location_quality',v_prev.location_quality,
      'location_basis',v_prev.location_basis,
      'location_source',v_prev.location_source,
      'location_note',v_prev.location_note,
      'address_normalized',v_prev.address_normalized,
      'event_status',(select e.status from public.events e where e.id=new.event_id)));
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(v_place.longitude,v_place.latitude),4326)::extensions.geography;
  new.location_auto_place_id := v_place.id;
  new.location_basis := v_place.basis;
  new.location_source := v_place.source_ref;
  if v_place.method='settlement_center' then
    new.venue_point := null;
    new.fallback_point := v_point;
    new.location_precision := 'settlement_center';
    new.location_quality := 'fallback_center';
    new.location_note := 'Zināma tikai apdzīvotā vieta; kartē rādīts tās centrs.';
    new.location_review_reason := new.location_note;
  else
    new.venue_point := v_point;
    new.fallback_point := null;
    new.address_normalized := coalesce(v_place.address,new.address_normalized);
    new.location_precision := case when v_place.method='culture_institution' then 'venue' else 'exact_address' end;
    new.location_quality := 'source_exact';
    new.location_note := case v_place.method
      when 'address_register' then 'Adrese atrasta Valsts adrešu reģistrā.'
      when 'culture_institution' then 'Vieta atrasta Latvijas kultūras institūciju sarakstā (kulturasdati.lv).'
      else 'Adrese nolasīta no avota lapas un atrasta Valsts adrešu reģistrā.' end;
    new.location_review_reason := case when v_place.method='source_page_address'
      then 'Adrese nolasīta no avota lapas; jāapstiprina.' end;
  end if;
  return new;
end
$$;

-- After classify_event_location and the saved admin mapping (triggers fire in name order).
create or replace trigger zzz_apply_auto_location_before_write
  before insert or update on public.event_locations
  for each row execute function meets_private.apply_auto_location_before_write();

-- Saves the places the plan resolved and gives their point to the waiting events.
-- p_dry_run=true only reports.
create or replace function meets_private.location_auto_run(p_dry_run boolean default false, p_steps text[] default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_rows meets_private.location_auto_plan_row[];
  v_summary jsonb;
  v_places integer := 0;
  v_events integer := 0;
begin
  if not p_dry_run and not pg_try_advisory_xact_lock(201111,1) then return jsonb_build_object('state','busy'); end if;
  v_rows := array(select p from meets_private.location_auto_plan(p_steps) p);

  select jsonb_build_object(
           'places',count(*),'events',coalesce(sum(p.events),0),
           'manualPlaces',count(*) filter (where p.decision='manual'),
           'manualEvents',coalesce(sum(p.events) filter (where p.decision='manual'),0),
           'byMethod',coalesce((
              select jsonb_object_agg(m.method,jsonb_build_object('places',m.places,'events',m.events))
                from (select q.method,count(*) places,sum(q.events) events from unnest(v_rows) q
                       where q.decision in ('apply','existing') group by q.method) m),'{}'::jsonb))
    into v_summary from unnest(v_rows) p;
  if p_dry_run then return v_summary||jsonb_build_object('dryRun',true); end if;

  insert into meets_private.location_auto_places(place_key,municipality_id,method,source_ref,label,address,latitude,longitude,basis,sample_name)
  select p.place_key,p.municipality_id,p.method,p.source_ref,p.matched_label,p.matched_address,p.latitude,p.longitude,
         case p.method
           when 'address_register' then 'auto: the one State Address Register address of the event text in its municipality'
           when 'culture_institution' then 'auto: the one institution of this name in the municipality (kulturasdati.lv)'
           when 'settlement_center' then 'auto: centre of the named town, village or parish (VZD place centroids)'
           else 'auto: source page address found in the State Address Register' end,
         p.sample_name
    from unnest(v_rows) p
   where p.decision='apply'
  on conflict(place_key,municipality_id) do nothing;
  get diagnostics v_places=row_count;

  -- Writing the row runs the trigger above.
  update public.event_locations l
     set venue_name=l.venue_name
   where l.event_id in (select unnest(p.event_ids) from unnest(v_rows) p where p.decision in ('apply','existing'))
     and l.verified_at is null and l.location_auto_place_id is null;
  select count(*) into v_events from public.event_locations l
   where l.location_auto_place_id is not null
     and l.event_id in (select unnest(p.event_ids) from unnest(v_rows) p where p.decision in ('apply','existing'));

  -- What is left for the admin, with reasons (meets_private.location_auto_plan_snapshot).
  perform meets_private.location_auto_plan_refresh(p_steps);

  return v_summary||jsonb_build_object('newPlaces',v_places,'appliedEvents',v_events,
           'published',meets_private.auto_publish_verified_imports());
end
$$;

-- Undoes automatic points: one place (p_place_id), every place of a method
-- (p_method) or everything (p_all). The earlier point and fields come back from
-- the log, events the automatic point had published return to review, and the
-- place stays blocked (active=false) so the next run does not resolve it again.
create or replace function meets_private.location_auto_revert(
  p_place_id bigint default null, p_method text default null, p_all boolean default false, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_places bigint[];
  r record;
  v_events integer := 0;
  v_unpublished integer := 0;
begin
  if p_place_id is null and p_method is null and not coalesce(p_all,false) then
    raise exception 'Give p_place_id, p_method or p_all';
  end if;
  select coalesce(array_agg(p.id),'{}') into v_places from meets_private.location_auto_places p
   where p.active and (coalesce(p_all,false) or p.id=p_place_id or p.method=p_method);

  update meets_private.location_auto_places
     set active=false,reverted_at=now(),revert_note=p_note where id=any(v_places);

  for r in
    select l.id,l.event_id,l.location_auto_place_id place_id,
           (select g.previous from meets_private.location_auto_log g
             where g.event_id=l.event_id and g.place_id=l.location_auto_place_id and g.reverted_at is null
             order by g.id limit 1) previous
      from public.event_locations l
     where l.location_auto_place_id=any(v_places) and l.verified_at is null
  loop
    update public.event_locations l
       set location_auto_place_id=null,
           venue_point=case when r.previous->>'venue_latitude' is not null then
             extensions.st_setsrid(extensions.st_makepoint((r.previous->>'venue_longitude')::float8,(r.previous->>'venue_latitude')::float8),4326)::extensions.geography end,
           fallback_point=case when r.previous->>'venue_latitude' is null and r.previous->>'fallback_latitude' is not null then
             extensions.st_setsrid(extensions.st_makepoint((r.previous->>'fallback_longitude')::float8,(r.previous->>'fallback_latitude')::float8),4326)::extensions.geography end,
           location_precision=coalesce(r.previous->>'location_precision','unresolved'),
           location_basis=r.previous->>'location_basis',
           location_source=r.previous->>'location_source',
           location_note=r.previous->>'location_note',
           address_normalized=r.previous->>'address_normalized'
     where l.id=r.id;
    update meets_private.location_auto_log set reverted_at=now()
     where event_id=r.event_id and place_id=r.place_id and reverted_at is null;
    v_events := v_events+1;

    if r.previous->>'event_status'='pending_review'
       and coalesce((meets_private.event_publishability(r.event_id)->>'allowed')::boolean,false) is not true then
      update public.events e
         set status='pending_review',review_status='needs_review',updated_at=now(),
             last_change_summary='Automatic location point reverted; event returned to review'
       where e.id=r.event_id and e.status='published';
      if found then v_unpublished := v_unpublished+1; end if;
    end if;
  end loop;
  return jsonb_build_object('places',cardinality(v_places),'events',v_events,'returnedToReview',v_unpublished);
end
$$;

-- Publishing: an exact address from the register or the institutions table counts
-- like a verified point; a town centre or a source page address does not.
create or replace function meets_private.event_publishability(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event public.events%rowtype;
  v_location public.event_locations%rowtype;
begin
  select * into v_event from public.events where id=p_event_id;
  if v_event.id is null then
    return jsonb_build_object('allowed',false,'reason','Pasākums nav atrasts.');
  end if;

  if v_event.attendance_mode='online' then
    return jsonb_build_object('allowed',true,'reason','Tiešsaistes pasākumam fiziska lokācija nav obligāta.');
  end if;

  select * into v_location from public.event_locations where event_id=p_event_id;
  if v_location.event_id is null then
    return jsonb_build_object('allowed',false,'reason','Nav norises vietas ieraksta.');
  end if;

  if v_location.location_quality='verified_exact'
     and v_location.venue_point is not null
     and v_location.verified_at is not null then
    return jsonb_build_object('allowed',true,'reason','Precīza lokācija verificēta.');
  end if;

  if v_location.location_quality='source_exact'
     and v_location.venue_point is not null
     and exists (select 1 from meets_private.location_auto_places p
                  where p.id=v_location.location_auto_place_id and p.active
                    and p.method in ('address_register','culture_institution')) then
    return jsonb_build_object('allowed',true,'reason','Precīza adrese no oficiāla reģistra.');
  end if;

  return jsonb_build_object(
    'allowed',false,
    'reason',case coalesce(v_location.location_quality,'missing_point')
      when 'fallback_center' then 'Izmantots centra aizvietojuma punkts.'
      when 'venue_area' then 'Norises vieta ir tikai aptuvena.'
      when 'venue_unverified' then 'Norises vietas punkts nav verificēts.'
      when 'source_exact' then 'Avotā ir precīza vieta, bet nav admin verifikācijas.'
      when 'missing_point' then 'Nav precīza kartes punkta.'
      else 'Lokācija nav precīzi verificēta.'
    end,
    'location_quality',v_location.location_quality
  );
end
$function$;

create or replace function meets_private.auto_publish_verified_imports()
returns integer
language sql
security definer
set search_path to ''
as $function$
  -- Imported upcoming events from sources the admin keeps visible are published as soon
  -- as their exact location is verified or comes from an official register (the same rule
  -- as meets_private.event_publishability, enforced again by the enforce_publish_quality trigger).
  with published as (
    update public.events e
    set status = 'published', updated_at = now()
    where e.status = 'pending_review'
      and e.import_key is not null
      and coalesce(e.date_to, e.date_from) >= (now() at time zone 'Europe/Riga')::date
      and exists (
        select 1 from public.event_locations l
        where l.event_id = e.id
          and l.venue_point is not null
          and ((l.location_quality = 'verified_exact' and l.verified_at is not null)
            or (l.location_quality = 'source_exact' and exists (
                  select 1 from meets_private.location_auto_places p
                  where p.id = l.location_auto_place_id and p.active
                    and p.method in ('address_register','culture_institution'))))
      )
      and not exists (
        select 1 from public.event_sources es join public.sources s on s.id = es.source_id
        where es.event_id = e.id and s.map_visible is false
      )
    returning 1
  )
  select count(*)::integer from published
$function$;

-- Places with an automatic point are no longer searched for suggestions.
create or replace function meets_private.place_search_enqueue()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  with places as (
    select l.venue_name,mode() within group (order by l.municipality_id) municipality_id,count(*) n,
           max(nullif(btrim(l.address_raw),'')) filter (where l.address_raw is distinct from l.venue_name) address_text
      from public.events e
      join public.event_locations l on l.event_id=e.id
     where e.status in ('pending_review','published')
       and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date
       and coalesce(e.attendance_mode,'')<>'online'
       and l.verified_at is null
       and l.location_auto_place_id is null
       and coalesce(l.location_quality,'')<>'verified_exact'
       and length(btrim(coalesce(l.venue_name,'')))>=3
     group by l.venue_name
  )
  insert into meets_private.place_search_queue as q(venue_name,municipality_id,query,event_count,address_text)
  select p.venue_name,p.municipality_id,meets_private.place_search_query(p.venue_name,m.name),p.n,p.address_text
    from places p left join public.municipalities m on m.id=p.municipality_id
  on conflict(venue_name) do update
     set event_count=excluded.event_count,
         address_text=excluded.address_text,
         municipality_id=excluded.municipality_id,
         query=excluded.query,
         -- A place whose search text changed (e.g. its municipality became known) is searched again.
         state=case when q.query<>excluded.query and q.state in ('done','failed') then 'queued' else q.state end,
         attempts=case when q.query<>excluded.query and q.state in ('done','failed') then 0 else q.attempts end,
         known_checked_at=case when q.query<>excluded.query and q.state in ('done','failed') then null else q.known_checked_at end;
  get diagnostics v_count=row_count;

  -- Events imported after their place was searched get the same suggestions.
  update public.event_locations l
     set geocode_query=left(q.query,300),geocode_candidates=q.candidates,geocode_suggested_at=q.finished_at
    from meets_private.place_search_queue q
   where q.state='done' and l.venue_name=q.venue_name and l.verified_at is null and l.geocode_suggested_at is null
     and l.location_auto_place_id is null;
  return v_count;
end
$$;

-- The admin catalogue says how an automatic point was found (location_auto).
create or replace function meets_private.read_admin_catalog_rows(p_session_token text, p_past boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  return jsonb_build_object(
    'fetchedAt',now(),
    'fields',jsonb_build_array('id','title','description','date_from','date_to','time_from','time_to','time_type',
      'attendance_mode','record_type','event_type','primary_category','status','price_status','price_min','price_max',
      'venue_name','address_raw','location_precision','municipality','settlement','country_code','latitude','longitude',
      'location_quality','location_review_reason','geocode_query','geocode_candidates','geocode_suggested_at',
      'governing_body','competition_name','sport_format','tags','sources','location_auto'),
    'rows',(
      select coalesce(jsonb_agg(jsonb_build_array(
        c.id,c.title,c.description,c.date_from,c.date_to,c.time_from,c.time_to,c.time_type,
        c.attendance_mode,c.record_type,c.event_type,c.primary_category,c.status,c.price_status,c.price_min,c.price_max,
        c.venue_name,c.address_raw,c.location_precision,c.municipality,c.settlement,c.country_code,c.latitude,c.longitude,
        c.location_quality,c.location_review_reason,c.geocode_query,c.geocode_candidates,c.geocode_suggested_at,
        c.governing_body,c.competition_name,c.sport_format,c.tags,c.sources,c.location_auto
      ) order by c.date_from,c.id),'[]'::jsonb)
      from (
        select v.id,v.title,left(regexp_replace(coalesce(v.description,''),'\s+',' ','g'),300) as description,
               v.date_from,v.date_to,v.time_from,v.time_to,v.time_type,v.attendance_mode,v.record_type,v.event_type,
               v.primary_category,v.status,v.price_status,v.price_min,v.price_max,
               v.venue_name,v.address_raw,v.location_precision,v.municipality,v.settlement,v.country_code,
               round(v.latitude::numeric,6) as latitude,round(v.longitude::numeric,6) as longitude,
               l.location_quality,l.location_review_reason,l.geocode_query,
               nullif(l.geocode_candidates,'[]'::jsonb) as geocode_candidates,l.geocode_suggested_at,
               sc.governing_body,sc.name as competition_name,coalesce(sm.sport_format,sc.sport_format) as sport_format,
               (select nullif(jsonb_agg(c.name order by c.name),'[]'::jsonb)
                  from public.event_categories ec
                  join public.categories c on c.id=ec.category_id
                 where ec.event_id=v.id) as tags,
               (select coalesce(jsonb_agg(jsonb_build_object('source',s.domain,'url',es.source_url) order by es.id),'[]'::jsonb)
                  from public.event_sources es
                  join public.sources s on s.id=es.source_id
                 where es.event_id=v.id) as sources,
               (select ap.method from meets_private.location_auto_places ap
                 where ap.id=l.location_auto_place_id and ap.active) as location_auto
          from public.event_overview v
          left join public.event_locations l on l.event_id=v.id
          left join public.event_sports_metadata sm on sm.event_id=v.id
          left join public.sports_competitions sc on sc.id=sm.competition_id
         where case when p_past
                 then coalesce(v.date_to,v.date_from) between (now() at time zone 'Europe/Riga')::date-14 and (now() at time zone 'Europe/Riga')::date-1
                 else coalesce(v.date_to,v.date_from)>=(now() at time zone 'Europe/Riga')::date end
      ) c
    )
  );
end
$function$;

revoke execute on function meets_private.apply_auto_location_before_write() from public,anon,authenticated;
revoke execute on function meets_private.location_auto_run(boolean,text[]) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_revert(bigint,text,boolean,text) from public,anon,authenticated;
revoke execute on function meets_private.event_publishability(uuid) from public,anon,authenticated;
revoke execute on function meets_private.auto_publish_verified_imports() from public,anon,authenticated;
revoke execute on function meets_private.place_search_enqueue() from public,anon,authenticated;
revoke all on function meets_private.read_admin_catalog_rows(text,boolean) from public,anon,authenticated;

-- New imports: every hour, after the place search has queued them.
select cron.schedule('meets-location-auto','53 * * * *',$cron$select meets_private.location_auto_run()$cron$);

-- Reference tables: monthly, the day after the address register reload.
select cron.schedule('meets-place-reference-monthly','37 3 4 * *',$cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/load-place-reference',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
$cron$);

-- Step 4 runs only while the setting is 'on'.
select cron.schedule('meets-location-source-pages','*/10 * * * *',$cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/extract-source-addresses',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
  where (select value from meets_private.app_settings where key='location_auto_source_pages')='on'
$cron$);
