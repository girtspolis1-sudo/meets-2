-- Organizer lifecycle (2026-11-02):
-- * the organizer's main address can carry map coordinates;
-- * a multi-day event can give each day its own time (schedule_kind 'dated',
--   recurrence_slots = [{date,start,end}]), published as one event per day;
-- * organizers learn whether they publish without review (trusted);
-- * an organizer can delete all its events, then the organizer itself,
--   and a person without organizers can delete the MEETS account.

alter table public.meets_org_contact_details
  add column if not exists address_latitude double precision,
  add column if not exists address_longitude double precision;

alter table public.meets_submissions drop constraint if exists meets_submissions_schedule_kind_check;
alter table public.meets_submissions add constraint meets_submissions_schedule_kind_check
  check (schedule_kind = any (array['once','recurring','ongoing','dated']));
alter table public.meets_submissions drop constraint if exists meets_submission_recurrence_slots_type;
alter table public.meets_submissions add constraint meets_submission_recurrence_slots_type
  check (jsonb_typeof(recurrence_slots)='array' and jsonb_array_length(recurrence_slots)<=62);

create or replace function public.meets_org_is_trusted(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.meets_org_can_read(p_organization_id)
     and exists(select 1 from meets_private.trusted_organizations t where t.organization_id=p_organization_id)
$function$;

-- Removes every event of the organizer: public events are cancelled, the
-- submissions themselves deleted. Owner or administrator only.
create or replace function public.meets_org_delete_events(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_events int:=0; v_submissions int:=0;
begin
  if not exists(
    select 1 from public.meets_organizations o where o.id=p_organization_id and o.owner_id=auth.uid()
    union all
    select 1 from public.meets_organization_members m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.role in ('owner','admin')
  ) then raise exception 'Dzēst pasākumus var tikai organizatora īpašnieks vai administrators' using errcode='42501'; end if;

  update public.events e set status='cancelled',updated_at=now(),last_change_summary='Organizators izdzēsa pasākumu'
   where e.status<>'cancelled'
     and e.id in (select s.event_id from public.meets_submissions s where s.organization_id=p_organization_id and s.event_id is not null
                  union select o.event_id from public.meets_published_occurrences o
                         join public.meets_submissions s on s.id=o.submission_id where s.organization_id=p_organization_id);
  get diagnostics v_events = row_count;
  delete from public.meets_submissions where organization_id=p_organization_id;
  get diagnostics v_submissions = row_count;
  return jsonb_build_object('events_cancelled',v_events,'submissions_deleted',v_submissions);
end
$function$;

-- Deletes the organizer (its places, team and contacts go with it). Only the
-- owner, and only once its events are deleted.
create or replace function public.meets_org_delete(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not exists(select 1 from public.meets_organizations o where o.id=p_organization_id and o.owner_id=auth.uid()) then
    raise exception 'Organizatoru var dzēst tikai tā īpašnieks' using errcode='42501';
  end if;
  if exists(select 1 from public.meets_submissions s where s.organization_id=p_organization_id) then
    raise exception 'Vispirms izdzēs visus organizatora pasākumus' using errcode='22023';
  end if;
  delete from public.meets_organizations where id=p_organization_id;
  return jsonb_build_object('deleted',true);
end
$function$;

-- Deletes the signed-in person's MEETS account. Organizers they own must be
-- deleted first; events they wrote for other organizers stay with those
-- organizers (the owner becomes the author).
create or replace function public.meets_account_delete()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Lūdzu, pieslēdzies' using errcode='42501'; end if;
  if exists(select 1 from public.meets_organizations o where o.owner_id=v_user) then
    raise exception 'Vispirms izdzēs savus organizatorus' using errcode='22023';
  end if;
  update public.meets_submissions s set author_id=o.owner_id
    from public.meets_organizations o where o.id=s.organization_id and s.author_id=v_user;
  delete from public.meets_organization_invitations where created_by=v_user;
  update public.meets_organization_invitations set claimed_by=null where claimed_by=v_user;
  delete from auth.users where id=v_user;
  return jsonb_build_object('deleted',true);
end
$function$;

revoke all on function public.meets_org_is_trusted(uuid) from public, anon;
revoke all on function public.meets_org_delete_events(uuid) from public, anon;
revoke all on function public.meets_org_delete(uuid) from public, anon;
revoke all on function public.meets_account_delete() from public, anon;
grant execute on function public.meets_org_is_trusted(uuid) to authenticated;
grant execute on function public.meets_org_delete_events(uuid) to authenticated;
grant execute on function public.meets_org_delete(uuid) to authenticated;
grant execute on function public.meets_account_delete() to authenticated;

-- Publishing: also the 'dated' schedule (one event per day with its own time).
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
 update public.meets_submissions set status='published',event_id=v_first,
  admin_note=left(coalesce(p_note,''),1000),latitude=v_lat,longitude=v_lon,updated_at=now() where id=p_id;
 return jsonb_build_object('status','published','event_id',v_first,'occurrences',v_count);
end $function$;
