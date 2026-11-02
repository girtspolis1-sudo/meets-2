-- Organizers can change and cancel events that are already published.
--
-- * A change to a published event goes back to review (status pending_review,
--   event_id kept). The public event keeps its current data until MEETS
--   approves the change; trusted organizers are re-published automatically.
-- * Cancelling marks the submission and all of its public events cancelled,
--   so they leave the map and the list at once.
-- * Re-publishing now also updates dates, times, category and schedule type,
--   and cancels occurrences of a weekly schedule that are no longer in it.

alter table public.meets_submissions drop constraint if exists meets_submissions_status_check;
alter table public.meets_submissions add constraint meets_submissions_status_check
  check (status = any (array['draft','pending_review','published','rejected','declined','cancelled']));

create or replace function public.meets_org_update_published_submission(p_id uuid, p_values jsonb)
returns public.meets_submissions
language plpgsql
security definer
set search_path to ''
as $function$
declare
  s public.meets_submissions%rowtype;
  v_venue uuid := nullif(p_values->>'venue_id','')::uuid;
begin
  select * into s from public.meets_submissions where id=p_id for update;
  if not found then raise exception 'Pasākums nav atrasts' using errcode='P0002'; end if;
  if not public.meets_org_can_edit(s.organization_id) then
    raise exception 'Nav tiesību labot šo pasākumu' using errcode='42501';
  end if;
  if s.event_id is null or s.status not in ('published','pending_review') then
    raise exception 'Šo pasākumu labo parastajā redaktorā' using errcode='22023';
  end if;
  if v_venue is not null and not exists(
    select 1 from public.meets_venues v where v.id=v_venue and (v.organization_id=s.organization_id or v.is_public=true)
  ) then
    raise exception 'Šo norises vietu nevar izmantot' using errcode='42501';
  end if;

  update public.meets_submissions set
    title=left(trim(coalesce(p_values->>'title',title)),200),
    description=left(coalesce(p_values->>'description',''),6000),
    category=left(coalesce(nullif(p_values->>'category',''),category),100),
    date_from=(p_values->>'date_from')::date,
    date_to=nullif(p_values->>'date_to','')::date,
    time_from=nullif(p_values->>'time_from','')::time,
    time_to=nullif(p_values->>'time_to','')::time,
    venue_id=v_venue,
    venue_name=left(coalesce(p_values->>'venue_name',''),200),
    address=left(coalesce(p_values->>'address',''),300),
    latitude=nullif(p_values->>'latitude','')::double precision,
    longitude=nullif(p_values->>'longitude','')::double precision,
    price_status=coalesce(nullif(p_values->>'price_status',''),'unknown'),
    price_min=nullif(p_values->>'price_min','')::numeric,
    price_max=nullif(p_values->>'price_max','')::numeric,
    schedule_kind=coalesce(nullif(p_values->>'schedule_kind',''),schedule_kind),
    recurrence_note=left(coalesce(p_values->>'recurrence_note',''),300),
    recurrence_slots=coalesce(p_values->'recurrence_slots','[]'::jsonb),
    status='pending_review',
    updated_at=now()
  where id=p_id
  returning * into s;
  return s;
end
$function$;

create or replace function public.meets_org_cancel_submission(p_id uuid, p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  s public.meets_submissions%rowtype;
  v_events int := 0;
begin
  select * into s from public.meets_submissions where id=p_id for update;
  if not found then raise exception 'Pasākums nav atrasts' using errcode='P0002'; end if;
  if not public.meets_org_can_edit(s.organization_id) then
    raise exception 'Nav tiesību atcelt šo pasākumu' using errcode='42501';
  end if;
  if s.status in ('cancelled','declined') then
    raise exception 'Pasākums jau ir atcelts vai noraidīts' using errcode='22023';
  end if;

  update public.events e set status='cancelled',updated_at=now(),
         last_change_summary=left('Organizators atcēla pasākumu'||coalesce(': '||nullif(trim(p_reason),''),''),300)
   where e.status<>'cancelled'
     and (e.id=s.event_id or e.id in (select o.event_id from public.meets_published_occurrences o where o.submission_id=s.id));
  get diagnostics v_events = row_count;

  update public.meets_submissions set status='cancelled',updated_at=now() where id=p_id;
  return jsonb_build_object('status','cancelled','events',v_events);
end
$function$;

revoke all on function public.meets_org_update_published_submission(uuid,jsonb) from public, anon;
revoke all on function public.meets_org_cancel_submission(uuid,text) from public, anon;
grant execute on function public.meets_org_update_published_submission(uuid,jsonb) to authenticated;
grant execute on function public.meets_org_cancel_submission(uuid,text) to authenticated;

-- A changed published event is announced to admins as a resubmission.
create or replace function meets_private.submission_after_write()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_author text; v_action text; v_blockers text[]; v_trusted boolean; v_result jsonb; s public.meets_submissions%rowtype;
begin
  if meets_private.is_meets_admin() then return new; end if;
  if new.status<>'pending_review' then return new; end if;

  if tg_op='INSERT' or old.status is distinct from 'pending_review' then
    v_action := case when tg_op='UPDATE' and old.status in ('rejected','published') then 'resubmitted' else 'submitted' end;
    insert into meets_private.submission_events(submission_id,action,actor_id) values(new.id,v_action,auth.uid());
    select email into v_author from auth.users where id=new.author_id;
    v_trusted := exists(select 1 from meets_private.trusted_organizations t where t.organization_id=new.organization_id);

    if v_trusted then
      v_blockers := meets_private.auto_publish_blockers(new);
      if cardinality(v_blockers)=0 then
        begin
          v_result := meets_private.publish_submission(new.id,'',null,null);
        exception when others then
          v_blockers := array[sqlerrm];
        end;
      end if;
    end if;

    if v_result is not null then
      select * into s from public.meets_submissions where id=new.id;
      update public.meets_submissions set reviewed_at=now() where id=new.id;
      insert into meets_private.submission_events(submission_id,action,note) values(new.id,'auto_published','Uzticams organizators');
      perform meets_private.notify_admins('admin_auto_published',s,'Automātiski publicēts: '||s.title,'Uzticama organizatora pasākums publicēts automātiski');
      perform meets_private.queue_email('organizer_published',s.id,v_author,'Pasākums publicēts: '||s.title,
        'Tavs pasākums ir publicēts MEETS',meets_private.submission_summary(s),null,
        'Skatīt pasākumu',meets_private.setting('site_url')||'/pasakumi/'||s.event_id);
      return new;
    end if;

    perform meets_private.notify_admins('admin_'||v_action,new,
      case when v_action='resubmitted' then 'Labots pasākums atkal gaida pārbaudi: ' else 'Jauns pasākums pārbaudei: ' end||new.title,
      case when tg_op='UPDATE' and old.status='published' then 'Organizators mainīja jau publicētu pasākumu; publiskā versija paliek līdz apstiprināšanai'
           when v_action='resubmitted' then 'Organizators izlaboja pasākumu un iesniedza to atkārtoti' else 'Saņemts jauns pasākums pārbaudei' end,
      case when v_trusted then 'Uzticams organizators, bet automātiski nepublicējām: '||array_to_string(v_blockers,', ')||'.' end);
    perform meets_private.queue_email('organizer_received',new.id,v_author,'Saņēmām tavu pasākumu: '||new.title,
      'Paldies! Pasākums ir saņemts un gaida pārbaudi',meets_private.submission_summary(new),
      'Parasti pasākumus pārbaudām 1–2 darba dienu laikā. Kad pasākums būs publicēts vai būs jāprecizē informācija, saņemsi e-pastu.',
      'Atvērt organizatora vidi',meets_private.setting('site_url')||'/organizators?org='||new.organization_id);
  elsif (new.title,new.description,new.date_from,new.date_to,new.time_from,new.time_to,new.venue_name,new.address,
         new.latitude,new.longitude,new.price_status,new.price_min,new.price_max,new.recurrence_slots,new.cover_image_path)
        is distinct from
        (old.title,old.description,old.date_from,old.date_to,old.time_from,old.time_to,old.venue_name,old.address,
         old.latitude,old.longitude,old.price_status,old.price_min,old.price_max,old.recurrence_slots,old.cover_image_path) then
    insert into meets_private.submission_events(submission_id,action,actor_id) values(new.id,'updated',auth.uid());
    if not exists(select 1 from meets_private.email_outbox where submission_id=new.id and kind like 'admin_%' and created_at>now()-interval '30 minutes') then
      perform meets_private.notify_admins('admin_updated',new,'Pārbaudāmais pasākums labots: '||new.title,'Organizators laboja pasākumu, kas gaida pārbaudi');
    end if;
  end if;
  return new;
end $function$;

-- Publishing again updates everything that can change, not only the texts.
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
 if s.schedule_kind='recurring' then
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
 update public.meets_submissions set status='published',event_id=v_first,
  admin_note=left(coalesce(p_note,''),1000),latitude=v_lat,longitude=v_lon,updated_at=now() where id=p_id;
 return jsonb_build_object('status','published','event_id',v_first,'occurrences',v_count);
end $function$;
