-- MEETS 2 | 2026-10-25
-- Apply only once to the active MEETS 2 Supabase project; first run already applied via SQL.
-- Public venues opt in. Public images are link-accessible even before moderator approval.
alter table public.meets_submissions
 add column if not exists price_min numeric(10,2),
 add column if not exists price_max numeric(10,2),
 add column if not exists cover_image_path text,
 add column if not exists recurrence_slots jsonb not null default '[]'::jsonb;
alter table public.meets_submissions drop constraint if exists meets_submission_price_values;
alter table public.meets_submissions add constraint meets_submission_price_values check (
 (price_min is null or price_min>=0) and (price_max is null or price_max>=0)
 and (price_max is null or price_min is null or price_max>=price_min)
);
alter table public.meets_submissions drop constraint if exists meets_submission_recurrence_slots_type;
alter table public.meets_submissions add constraint meets_submission_recurrence_slots_type check (
 jsonb_typeof(recurrence_slots)='array' and jsonb_array_length(recurrence_slots)<=14
);
alter table public.meets_venues add column if not exists is_public boolean not null default false;
create table if not exists public.meets_published_occurrences (
 submission_id uuid not null references public.meets_submissions(id) on delete cascade,
 event_id uuid not null unique references public.events(id) on delete cascade,
 venue_id uuid references public.meets_venues(id) on delete set null,
 primary key(submission_id,event_id)
);
create index if not exists meets_occurrences_venue_idx on public.meets_published_occurrences(venue_id);
alter table public.meets_published_occurrences enable row level security;
revoke all on public.meets_published_occurrences from anon,authenticated;
insert into public.meets_published_occurrences(submission_id,event_id,venue_id)
select s.id,s.event_id,s.venue_id from public.meets_submissions s
where s.status='published' and s.event_id is not null on conflict do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('meets-event-images','meets-event-images',true,5242880,array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "meets event images insert draft only" on storage.objects;
create policy "meets event images insert draft only" on storage.objects for insert to authenticated
with check (
 bucket_id='meets-event-images'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists (
  select 1 from public.meets_submissions s
  where s.id::text=(storage.foldername(name))[2] and s.author_id=(select auth.uid()) and s.status='draft'
 )
);

CREATE OR REPLACE FUNCTION public.meets_admin_review_submission(p_session_token text, p_id uuid, p_approve boolean, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select public.meets_admin_review_submission_v2(p_session_token,p_id,p_approve,p_note,null,null)
$function$;

CREATE OR REPLACE FUNCTION public.meets_admin_review_submission_v2(p_session_token text, p_id uuid, p_approve boolean, p_note text DEFAULT ''::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 s public.meets_submissions%rowtype;
 v_run uuid;
 v_event uuid;
 v_first uuid;
 v_lat double precision;
 v_lon double precision;
 v_d date;
 v_slot jsonb;
 v_weekday int;
 v_start time;
 v_finish time;
 v_key text;
 v_count int := 0;
 v_begin timestamp;
 v_end timestamp;
begin
 if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized'; end if;
 select * into s from public.meets_submissions where id=p_id for update;
 if not found or s.status<>'pending_review' then raise exception 'Submission not pending'; end if;
 if not p_approve then
  update public.meets_submissions set status='rejected',admin_note=left(coalesce(p_note,''),1000),updated_at=now() where id=p_id;
  return jsonb_build_object('status','rejected');
 end if;
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
       'single_day','fixed_interval','in_person','event','Pasākums',s.category,'published',
       s.price_status,s.price_min,s.price_max,'EUR',v_run,'reviewed')
      on conflict (import_key) do update set title=excluded.title,description=excluded.description,
        price_status=excluded.price_status,price_min=excluded.price_min,price_max=excluded.price_max
      returning id into v_event;
      insert into public.event_locations(event_id,venue_name,address_raw,venue_point,map_point,location_precision,location_quality,country_code)
      values(v_event,s.venue_name,s.address,
       extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography,
       extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography,
       'venue','verified_exact','LV')
      on conflict (event_id) do update set venue_name=excluded.venue_name,address_raw=excluded.address_raw,
       venue_point=excluded.venue_point,map_point=excluded.map_point,location_precision=excluded.location_precision,location_quality=excluded.location_quality;
      insert into public.meets_published_occurrences(submission_id,event_id,venue_id)
       values(s.id,v_event,s.venue_id) on conflict (event_id) do update set venue_id=excluded.venue_id;
      v_begin:=(v_d::text||' '||v_start::text)::timestamp;
      v_end:=(v_d::text||' '||v_finish::text)::timestamp;
      insert into public.event_occurrences(event_id,occurrence_key,occurrence_kind,date_from,date_to,time_from,time_to,
       time_type,timezone,starts_at,ends_at)
      values(v_event,v_key,'confirmed_date',v_d,v_d,v_start,v_finish,'fixed_interval','Europe/Riga',
       v_begin at time zone 'Europe/Riga',v_end at time zone 'Europe/Riga')
      on conflict (event_id,occurrence_key) do update set time_from=excluded.time_from,time_to=excluded.time_to;
      if v_first is null then v_first:=v_event; end if;
    end loop;
   end loop;
   if v_count=0 then raise exception 'Grafikā norādītajā periodā nav nevienas norises reizes'; end if;
 else
   insert into public.events(import_key,title,description,date_from,date_to,time_from,time_to,
    schedule_type,time_type,attendance_mode,record_type,event_type,primary_category,status,
    price_status,price_min,price_max,currency,import_run_id,review_status)
   values('meets-user:'||s.id,s.title,s.description,s.date_from,s.date_to,s.time_from,s.time_to,
    case when s.date_to is not null and s.date_to>s.date_from then 'continuous' else 'single_day' end,
    case when s.time_from is null then 'unspecified' when s.time_to is null then 'start_only' else 'fixed_interval' end,
    'in_person','event','Pasākums',s.category,'published',s.price_status,s.price_min,s.price_max,'EUR',v_run,'reviewed')
   on conflict (import_key) do update set title=excluded.title,description=excluded.description,
    price_status=excluded.price_status,price_min=excluded.price_min,price_max=excluded.price_max
   returning id into v_event;
   insert into public.event_locations(event_id,venue_name,address_raw,venue_point,map_point,location_precision,location_quality,country_code)
   values(v_event,s.venue_name,s.address,
    extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography,
    'venue','verified_exact','LV')
   on conflict (event_id) do update set venue_name=excluded.venue_name,address_raw=excluded.address_raw,
    venue_point=excluded.venue_point,map_point=excluded.map_point,location_precision=excluded.location_precision,location_quality=excluded.location_quality;
   insert into public.meets_published_occurrences(submission_id,event_id,venue_id)
   values(s.id,v_event,s.venue_id) on conflict (event_id) do update set venue_id=excluded.venue_id;
   v_first:=v_event;v_count:=1;
 end if;
 update public.meets_submissions set status='published',event_id=v_first,
  admin_note=left(coalesce(p_note,''),1000),latitude=v_lat,longitude=v_lon,updated_at=now() where id=p_id;
 return jsonb_build_object('status','published','event_id',v_first,'occurrences',v_count);
end $function$;

CREATE OR REPLACE FUNCTION public.meets_public_catalog()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
          (select s.cover_image_path
           from public.meets_published_occurrences po
           join public.meets_submissions s on s.id=po.submission_id
           where po.event_id=v.id and s.status='published'
           limit 1) as cover_image_path,
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
        left join public.event_sports_metadata sm on sm.event_id = v.id
        left join public.sports_competitions sc on sc.id = sm.competition_id
        where v.status = 'published'
          -- A paused competition must hide its events as well as its filter option.
          and (sc.id is null or sc.active = true)
      ) catalog
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.meets_public_venue(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
  'id',v.id,'name',v.name,'address',v.address,'description',coalesce(v.description,''),
  'directions',coalesce(v.directions,''),'latitude',v.latitude,'longitude',v.longitude,
  'events',coalesce((
   select jsonb_agg(
    jsonb_build_object(
     'id',e.id,'title',e.title,'description',e.description,
     'date_from',e.date_from,'date_to',e.date_to,'time_from',e.time_from,'time_to',e.time_to,
     'price_status',e.price_status,'price_min',e.price_min,'price_max',e.price_max,
     'category',e.primary_category,'cover_image_path',s.cover_image_path
    ) order by e.date_from,e.time_from,e.id
   )
   from public.event_overview e
   left join public.meets_published_occurrences po on po.event_id=e.id
   left join public.meets_submissions s on s.id=po.submission_id and s.status='published'
   where e.status='published'
     and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date
     and e.date_from<=((now() at time zone 'Europe/Riga')::date+interval '6 months')::date
     and (
       po.venue_id=v.id
       or (
         v.latitude is not null and v.longitude is not null
         and e.latitude is not null and e.longitude is not null
         and e.location_precision in ('venue','exact_address')
         and lower(btrim(coalesce(e.venue_name,'')))=lower(btrim(v.name))
         and abs(e.latitude-v.latitude)<0.001
         and abs(e.longitude-v.longitude)<0.0015
       )
     )
  ),'[]'::jsonb)
 )
 from public.meets_venues v where v.id=p_id and v.is_public=true limit 1
$function$;

-- Public venue RPC is read-only for anonymous clients. Image insertion requires owning draft.

-- Moderation review also shows exact recurrence, price and image.
CREATE OR REPLACE FUNCTION public.meets_admin_user_submissions(p_session_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
  select s.id,s.organization_id,s.title,s.description,s.category,s.date_from,s.date_to,s.time_from,s.time_to,
    s.venue_name,s.address,s.latitude,s.longitude,s.status,s.admin_note,s.event_id,s.created_at,
    s.price_status,s.price_min,s.price_max,s.schedule_kind,s.recurrence_slots,s.cover_image_path,
    o.name as organization_name
  from public.meets_submissions s join public.meets_organizations o on o.id=s.organization_id
  where s.status in ('pending_review','rejected','published')
 ) x),'[]'::jsonb);
end $function$

