-- Organizer events carry how they take place and the call link.
create or replace function meets_private.publish_submission(p_id uuid, p_note text default ''::text, p_latitude double precision default null::double precision, p_longitude double precision default null::double precision)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
 s public.meets_submissions%rowtype;
 v_run uuid; v_event uuid; v_first uuid; v_lat double precision; v_lon double precision;
 v_d date; v_slot jsonb; v_weekday int; v_start time; v_finish time; v_key text; v_count int := 0;
 v_begin timestamp; v_end timestamp; v_ids uuid[] := '{}';
begin
 select * into s from public.meets_submissions where id=p_id for update;
 if not found or s.status<>'pending_review' then raise exception 'Submission not pending'; end if;
 v_lat:=coalesce(p_latitude,s.latitude);
 v_lon:=coalesce(p_longitude,s.longitude);
 if v_lat is null or v_lon is null or v_lat not between 55 and 59 or v_lon not between 20 and 29
 then raise exception 'Latvijas norises vietai nepieciešamas precīzas koordinātas'; end if;
 if s.price_status='paid' and (s.price_min is null or s.price_max is null or s.price_min<0 or s.price_max<s.price_min)
 then raise exception 'Pārbaudi maksas pasākuma cenas EUR'; end if;
 if s.schedule_kind='dated' then
  if jsonb_typeof(s.recurrence_slots)<>'array' or jsonb_array_length(s.recurrence_slots)=0
     or jsonb_array_length(s.recurrence_slots)>62 then raise exception 'Norādi katras dienas laiku'; end if;
 end if;
 if s.schedule_kind='recurring' then
  if s.date_to is null or s.date_to<s.date_from or s.date_to>s.date_from+120
  then raise exception 'Atkārtošanās periods nedrīkst pārsniegt 120 dienas'; end if;
  if jsonb_typeof(s.recurrence_slots)<>'array' or jsonb_array_length(s.recurrence_slots)=0
     or jsonb_array_length(s.recurrence_slots)>14 then raise exception 'Nekorekts atkārtošanās grafiks'; end if;
 end if;
 insert into public.import_runs(source_key,source_commit,snapshot_date,status,expected_count,imported_count,completed_at)
 values('meets-user-submissions','manual-recurrence-v3',current_date,'completed',1,1,now())
 on conflict (source_key) do update set imported_at=now()
 returning id into v_run;
 if s.schedule_kind='dated' then
   -- Several days, each with its own time: one public event per day.
   for v_slot in select value from jsonb_array_elements(s.recurrence_slots)
   loop
      if (v_slot->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or (v_slot->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or (v_slot->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then raise exception 'Nekorekti norises dienas/laika dati'; end if;
      v_d:=(v_slot->>'date')::date;
      v_start:=(v_slot->>'start')::time;
      v_finish:=(v_slot->>'end')::time;
      if v_finish<=v_start then raise exception 'Norises beigu laikam jābūt pēc sākuma'; end if;
      v_count:=v_count+1;
      v_key:='meets-user:'||s.id||':'||to_char(v_d,'YYYYMMDD')||'-'||to_char(v_start,'HH24MI');
      insert into public.events(import_key,title,description,date_from,date_to,time_from,time_to,
       schedule_type,time_type,attendance_mode,record_type,event_type,primary_category,status,
       price_status,price_min,price_max,currency,import_run_id,review_status)
      values(v_key,s.title,s.description,v_d,v_d,v_start,v_finish,
       'single_day','fixed_interval','in_person','event','Pasākums',s.category,'pending_review',
       s.price_status,s.price_min,s.price_max,'EUR',v_run,'reviewed')
      on conflict (import_key) do update set title=excluded.title,description=excluded.description,
        time_from=excluded.time_from,time_to=excluded.time_to,primary_category=excluded.primary_category,
        price_status=excluded.price_status,price_min=excluded.price_min,price_max=excluded.price_max
      returning id into v_event;
      insert into public.event_locations(event_id,venue_name,address_raw,venue_point,location_precision,location_quality,location_source,country_code,verified_at)
      values(v_event,s.venue_name,s.address,
       extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography,
       'venue','verified_exact','admin verified submission','LV',now())
      on conflict (event_id) do update set venue_name=excluded.venue_name,address_raw=excluded.address_raw,
       venue_point=excluded.venue_point,location_precision=excluded.location_precision,location_quality=excluded.location_quality,location_source=excluded.location_source,verified_at=excluded.verified_at;
      update public.events set status='published' where id=v_event and status<>'published';
      insert into public.meets_published_occurrences(submission_id,event_id,venue_id)
       values(s.id,v_event,s.venue_id) on conflict (event_id) do update set venue_id=excluded.venue_id;
      v_begin:=(v_d::text||' '||v_start::text)::timestamp;
      v_end:=(v_d::text||' '||v_finish::text)::timestamp;
      insert into public.event_occurrences(event_id,occurrence_key,occurrence_kind,date_from,date_to,time_from,time_to,
       time_type,timezone,starts_at,ends_at)
      values(v_event,v_key,'confirmed_date',v_d,v_d,v_start,v_finish,'fixed_interval','Europe/Riga',
       v_begin at time zone 'Europe/Riga',v_end at time zone 'Europe/Riga')
      on conflict (event_id,occurrence_key) do update set time_from=excluded.time_from,time_to=excluded.time_to,
       starts_at=excluded.starts_at,ends_at=excluded.ends_at;
      v_ids:=v_ids||v_event;
      if v_first is null then v_first:=v_event; end if;
   end loop;
   update public.events e set status='cancelled',updated_at=now(),last_change_summary='Norise izņemta no grafika'
    where e.status<>'cancelled' and not (e.id = any(v_ids))
      and e.id in (select o.event_id from public.meets_published_occurrences o where o.submission_id=s.id);
 elsif s.schedule_kind='recurring' then
   for v_d in select gs::date from generate_series(s.date_from::timestamp,s.date_to::timestamp,interval '1 day') gs
   loop
    for v_slot in select value from jsonb_array_elements(s.recurrence_slots)
    loop
      if (v_slot->>'weekday') !~ '^[1-7]$'
         or (v_slot->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or (v_slot->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then raise exception 'Nekorekti norises dienas/laika dati'; end if;
      v_weekday:=(v_slot->>'weekday')::int;
      if extract(isodow from v_d)::int<>v_weekday then continue; end if;
      v_start:=(v_slot->>'start')::time;
      v_finish:=(v_slot->>'end')::time;
      if v_finish<=v_start then raise exception 'Norises beigu laikam jābūt pēc sākuma'; end if;
      v_count:=v_count+1;
      if v_count>180 then raise exception 'Vienā sērijā ne vairāk kā 180 norises reižu'; end if;
      v_key:='meets-user:'||s.id||':'||to_char(v_d,'YYYYMMDD')||'-'||to_char(v_start,'HH24MI');
      insert into public.events(import_key,title,description,date_from,date_to,time_from,time_to,
       schedule_type,time_type,attendance_mode,record_type,event_type,primary_category,status,
       price_status,price_min,price_max,currency,import_run_id,review_status)
      values(v_key,s.title,s.description,v_d,v_d,v_start,v_finish,
       'single_day','fixed_interval','in_person','event','Pasākums',s.category,'pending_review',
       s.price_status,s.price_min,s.price_max,'EUR',v_run,'reviewed')
      on conflict (import_key) do update set title=excluded.title,description=excluded.description,
        time_from=excluded.time_from,time_to=excluded.time_to,primary_category=excluded.primary_category,
        price_status=excluded.price_status,price_min=excluded.price_min,price_max=excluded.price_max
      returning id into v_event;
      insert into public.event_locations(event_id,venue_name,address_raw,venue_point,location_precision,location_quality,location_source,country_code,verified_at)
      values(v_event,s.venue_name,s.address,
       extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography,
       'venue','verified_exact','admin verified submission','LV',now())
      on conflict (event_id) do update set venue_name=excluded.venue_name,address_raw=excluded.address_raw,
       venue_point=excluded.venue_point,location_precision=excluded.location_precision,location_quality=excluded.location_quality,location_source=excluded.location_source,verified_at=excluded.verified_at;
      update public.events set status='published' where id=v_event and status<>'published';
      insert into public.meets_published_occurrences(submission_id,event_id,venue_id)
       values(s.id,v_event,s.venue_id) on conflict (event_id) do update set venue_id=excluded.venue_id;
      v_begin:=(v_d::text||' '||v_start::text)::timestamp;
      v_end:=(v_d::text||' '||v_finish::text)::timestamp;
      insert into public.event_occurrences(event_id,occurrence_key,occurrence_kind,date_from,date_to,time_from,time_to,
       time_type,timezone,starts_at,ends_at)
      values(v_event,v_key,'confirmed_date',v_d,v_d,v_start,v_finish,'fixed_interval','Europe/Riga',
       v_begin at time zone 'Europe/Riga',v_end at time zone 'Europe/Riga')
      on conflict (event_id,occurrence_key) do update set time_from=excluded.time_from,time_to=excluded.time_to,
       starts_at=excluded.starts_at,ends_at=excluded.ends_at;
      v_ids:=v_ids||v_event;
      if v_first is null then v_first:=v_event; end if;
    end loop;
   end loop;
   if v_count=0 then raise exception 'Grafikā norādītajā periodā nav nevienas norises reizes'; end if;
   -- Dates dropped from a changed schedule no longer appear publicly.
   update public.events e set status='cancelled',updated_at=now(),last_change_summary='Norise izņemta no grafika'
    where e.status<>'cancelled' and not (e.id = any(v_ids))
      and e.id in (select o.event_id from public.meets_published_occurrences o where o.submission_id=s.id);
 else
   insert into public.events(import_key,title,description,date_from,date_to,time_from,time_to,
    schedule_type,time_type,attendance_mode,record_type,event_type,primary_category,status,
    price_status,price_min,price_max,currency,import_run_id,review_status)
   values('meets-user:'||s.id,s.title,s.description,s.date_from,s.date_to,s.time_from,s.time_to,
    case when s.date_to is not null and s.date_to>s.date_from then 'continuous' else 'single_day' end,
    case when s.time_from is null then 'unspecified' when s.time_to is null then 'start_only' else 'fixed_interval' end,
    'in_person','event','Pasākums',s.category,'pending_review',s.price_status,s.price_min,s.price_max,'EUR',v_run,'reviewed')
   on conflict (import_key) do update set title=excluded.title,description=excluded.description,
    date_from=excluded.date_from,date_to=excluded.date_to,time_from=excluded.time_from,time_to=excluded.time_to,
    schedule_type=excluded.schedule_type,time_type=excluded.time_type,primary_category=excluded.primary_category,
    price_status=excluded.price_status,price_min=excluded.price_min,price_max=excluded.price_max
   returning id into v_event;
   insert into public.event_locations(event_id,venue_name,address_raw,venue_point,location_precision,location_quality,location_source,country_code,verified_at)
   values(v_event,s.venue_name,s.address,
    extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography,
    'venue','verified_exact','admin verified submission','LV',now())
   on conflict (event_id) do update set venue_name=excluded.venue_name,address_raw=excluded.address_raw,
    venue_point=excluded.venue_point,location_precision=excluded.location_precision,location_quality=excluded.location_quality,location_source=excluded.location_source,verified_at=excluded.verified_at;
   update public.events set status='published' where id=v_event and status<>'published';
   insert into public.meets_published_occurrences(submission_id,event_id,venue_id)
   values(s.id,v_event,s.venue_id) on conflict (event_id) do update set venue_id=excluded.venue_id;
   v_first:=v_event;v_count:=1;
 end if;
 -- Online and hybrid events: how they take place and the call link, on every occurrence.
 update public.events e set attendance_mode=coalesce(s.attendance_mode,'in_person'),
  online_url=case when s.attendance_mode in ('online','hybrid') then s.online_url end
  where e.id in (select o.event_id from public.meets_published_occurrences o where o.submission_id=s.id)
    and e.status<>'cancelled';
 update public.meets_submissions set status='published',event_id=v_first,
  admin_note=left(coalesce(p_note,''),1000),latitude=v_lat,longitude=v_lon,updated_at=now() where id=p_id;
 return jsonb_build_object('status','published','event_id',v_first,'occurrences',v_count);
end $function$;

-- Public catalogue: the call link for online and hybrid events.
create or replace function public.meets_public_catalog()
 returns jsonb
 language sql
 security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'fetchedAt', now(),
    'competitions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'competition_key', sc.competition_key,
          'name', sc.name,
          'season', sc.season,
          'governing_body', sc.governing_body,
          'sport_format', sc.sport_format,
          'competition_type', sc.competition_type,
          'source_url', sc.source_url
        ) order by sc.name
      ), '[]'::jsonb)
      from public.sports_competitions sc
      where sc.active = true
    ),
    'events', (
      select coalesce(
        jsonb_agg(to_jsonb(catalog) order by catalog.date_from, catalog.id),
        '[]'::jsonb
      )
      from (
        select
          v.id,
          org.cover_image_path,
          org.organization_id,
          org.organizer_name,
          -- The call link is public only for events that take place online.
          case when ev.attendance_mode in ('online','hybrid') then ev.online_url end as online_url,
          coalesce((select bool_or(s.map_visible) from public.event_sources es
            join public.sources s on s.id=es.source_id where es.event_id=v.id),true) as map_visible,
          v.title, v.description, v.date_from, v.date_to, v.time_from, v.time_to, v.timezone,
          v.schedule_type, v.time_type, v.attendance_mode, v.record_type, v.event_type, v.primary_category,
          v.status, v.price_status, v.price_text, v.price_min, v.price_max, v.currency, v.terms,
          v.venue_name, v.address_raw, v.alternative_address, v.location_precision, v.location_note,
          v.municipality, v.settlement, v.country_code, v.latitude, v.longitude, v.updated_at,
          sc.governing_body, sc.competition_key, sc.name as competition_name, sc.season as competition_season,
          sc.competition_type, coalesce(sm.sport_format, sc.sport_format) as sport_format,
          sm.stage as competition_stage, sm.group_name as competition_group,
          coalesce(sm.age_group, sc.default_age_group) as age_group,
          sm.home_team, sm.away_team, sm.source_match_id,
          (
            select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb)
            from public.event_categories ec
            join public.categories c on c.id = ec.category_id
            where ec.event_id = v.id
          ) as tags,
          (
            select coalesce(
              jsonb_agg(jsonb_build_object('source', s.domain, 'url', es.source_url) order by es.id),
              '[]'::jsonb
            )
            from public.event_sources es
            join public.sources s on s.id = es.source_id
            where es.event_id = v.id
          ) as sources
        from public.event_overview v
        join public.events ev on ev.id = v.id
        left join public.event_sports_metadata sm on sm.event_id = v.id
        left join public.sports_competitions sc on sc.id = sm.competition_id
        left join lateral (
          select s.cover_image_path,
                 case when o.is_public then o.id end as organization_id,
                 case when o.is_public then o.name end as organizer_name
          from public.meets_published_occurrences po
          join public.meets_submissions s on s.id = po.submission_id
          left join public.meets_organizations o on o.id = s.organization_id
          where po.event_id = v.id and s.status = 'published'
          limit 1
        ) org on true
        where v.status = 'published'
          -- A paused competition must hide its events as well as its filter option.
          and (sc.id is null or sc.active = true)
      ) catalog
    )
  )
$function$;

