-- Trusted organizers publish without manual review (when automatic checks pass),
-- and admins get a daily summary instead of many separate e-mails.

-- 1. Publishing without the admin check, so the trigger can use it --------------
-- Also fixes publishing: events used to be inserted as 'published', which
-- enforce_publish_quality rejects for physical events, and wrote the generated
-- map_point column.
create or replace function meets_private.publish_submission(
  p_id uuid, p_note text default '', p_latitude double precision default null, p_longitude double precision default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
 s public.meets_submissions%rowtype;
 v_run uuid; v_event uuid; v_first uuid; v_lat double precision; v_lon double precision;
 v_d date; v_slot jsonb; v_weekday int; v_start time; v_finish time; v_key text; v_count int := 0;
 v_begin timestamp; v_end timestamp;
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
        price_status=excluded.price_status,price_min=excluded.price_min,price_max=excluded.price_max
      returning id into v_event;
      insert into public.event_locations(event_id,venue_name,address_raw,venue_point,location_precision,location_quality,location_source,country_code,verified_at)
      values(v_event,s.venue_name,s.address,
       extensions.st_setsrid(extensions.st_makepoint(v_lon,v_lat),4326)::extensions.geography,
       'venue','verified_exact','admin verified submission','LV',now())
      on conflict (event_id) do update set venue_name=excluded.venue_name,address_raw=excluded.address_raw,
       venue_point=excluded.venue_point,location_precision=excluded.location_precision,location_quality=excluded.location_quality,location_source=excluded.location_source,verified_at=excluded.verified_at;
      -- Events are created for review and published once the verified place exists
      -- (meets_private.enforce_publish_quality).
      update public.events set status='published' where id=v_event and status<>'published';
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
    'in_person','event','Pasākums',s.category,'pending_review',s.price_status,s.price_min,s.price_max,'EUR',v_run,'reviewed')
   on conflict (import_key) do update set title=excluded.title,description=excluded.description,
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
end $$;
revoke all on function meets_private.publish_submission(uuid,text,double precision,double precision) from public,anon,authenticated;

create or replace function public.meets_admin_review_submission_v2(p_session_token text, p_id uuid, p_approve boolean,
  p_note text default '', p_latitude double precision default null, p_longitude double precision default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
 if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized'; end if;
 if not p_approve then
  update public.meets_submissions set status='rejected',admin_note=left(coalesce(p_note,''),1000),updated_at=now()
   where id=p_id and status='pending_review';
  if not found then raise exception 'Submission not pending'; end if;
  return jsonb_build_object('status','rejected');
 end if;
 return meets_private.publish_submission(p_id,p_note,p_latitude,p_longitude);
end $$;

-- 2. Trusted organizers ----------------------------------------------------------
-- Kept apart from meets_organizations, which organizers can edit themselves.
create table if not exists meets_private.trusted_organizations(
  organization_id uuid primary key references public.meets_organizations(id) on delete cascade,
  trusted_at timestamptz not null default now(),
  trusted_by uuid
);
revoke all on meets_private.trusted_organizations from public,anon,authenticated;

alter table meets_private.submission_events drop constraint if exists submission_events_action_check;
alter table meets_private.submission_events add constraint submission_events_action_check
  check (action in ('submitted','resubmitted','updated','published','auto_published','changes_requested','declined'));

-- Why a trusted organizer's submission still needs a person; empty = publish.
create or replace function meets_private.auto_publish_blockers(s public.meets_submissions)
returns text[] language sql stable security definer set search_path to '' as $$
  select array_remove(array[
    case when s.latitude is null or s.longitude is null or s.latitude not between 55 and 59 or s.longitude not between 20 and 29
      then 'nav atzīmēta vieta kartē' end,
    case when coalesce(s.date_to,s.date_from) < (now() at time zone 'Europe/Riga')::date then 'datums jau pagājis' end,
    case when s.price_status='paid' and (s.price_min is null or s.price_max is null) then 'nav norādīta cena' end,
    case when exists(select 1 from public.events ev
                      where ev.status in ('published','pending_review')
                        and ev.date_from between s.date_from-1 and coalesce(s.date_to,s.date_from)+1
                        and extensions.similarity(lower(ev.title),lower(s.title))>0.45
                        and coalesce(ev.import_key,'') not like 'meets-user:'||s.id||'%')
      then 'iespējams dublikāts' end
  ],null)
$$;

-- 3. E-mail: hold admin notices for the daily summary ------------------------------
alter table meets_private.email_outbox drop constraint if exists email_outbox_status_check;
alter table meets_private.email_outbox add constraint email_outbox_status_check
  check (status in ('queued','sending','sent','failed','held','digested'));
insert into meets_private.app_settings(key,value) values ('admin_instant_limit','3') on conflict do nothing;

create or replace function meets_private.queue_email(
  p_kind text, p_submission uuid, p_to text, p_subject text, p_heading text,
  p_lines jsonb, p_note text, p_button_label text, p_button_url text, p_reply_to text default null,
  p_status text default 'queued')
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_html text; v_text text; v_line jsonb;
begin
  if coalesce(trim(p_to),'')='' then return; end if;
  v_html := '<div style="font-family:Arial,sans-serif;max-width:560px;color:#1b2140">'
    ||'<p style="color:#6d28d9;font-weight:700;letter-spacing:.08em;font-size:12px">MEETS</p>'
    ||'<h2 style="margin:0 0 16px">'||meets_private.html_escape(p_heading)||'</h2><table style="border-collapse:collapse">';
  v_text := p_heading||E'\n\n';
  for v_line in select value from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) loop
    if coalesce(v_line->>1,'')<>'' then
      v_html := v_html||'<tr><td style="padding:4px 12px 4px 0;color:#5b6280">'||meets_private.html_escape(v_line->>0)
        ||'</td><td style="padding:4px 0"><strong>'||meets_private.html_escape(v_line->>1)||'</strong></td></tr>';
      v_text := v_text||(v_line->>0)||': '||(v_line->>1)||E'\n';
    end if;
  end loop;
  v_html := v_html||'</table>';
  if coalesce(trim(p_note),'')<>'' then
    v_html := v_html||'<p style="background:#f3f0ff;border-radius:8px;padding:12px;white-space:pre-line">'||meets_private.html_escape(p_note)||'</p>';
    v_text := v_text||E'\n'||p_note||E'\n';
  end if;
  if p_button_url is not null then
    v_html := v_html||'<p style="margin-top:20px"><a href="'||meets_private.html_escape(p_button_url)
      ||'" style="background:#6d4aff;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">'
      ||meets_private.html_escape(p_button_label)||'</a></p>';
    v_text := v_text||E'\n'||p_button_label||': '||p_button_url||E'\n';
  end if;
  v_html := v_html||'<p style="color:#8a90a8;font-size:12px;margin-top:24px">Šo ziņu nosūtīja MEETS automātiski.</p></div>';
  insert into meets_private.email_outbox(kind,submission_id,to_email,reply_to,subject,html,body_text,status)
  values(p_kind,p_submission,lower(trim(p_to)),p_reply_to,left(p_subject,200),v_html,v_text,
    case when p_status in ('queued','held') then p_status else 'queued' end);
end $$;
drop function if exists meets_private.queue_email(text,uuid,text,text,text,jsonb,text,text,text,text);

-- The first few notices of the day go out at once; the rest wait for the summary.
-- Auto-published events are always only in the summary.
create or replace function meets_private.notify_admins(p_kind text, s public.meets_submissions, p_subject text, p_heading text, p_note text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare v_admin text; v_author text; v_sent int; v_limit int:=coalesce(meets_private.setting('admin_instant_limit')::int,3);
begin
  select email into v_author from auth.users where id=s.author_id;
  for v_admin in select email from meets_private.admin_email_allowlist loop
    select count(*) into v_sent from meets_private.email_outbox
     where to_email=v_admin and kind like 'admin_%' and status in ('queued','sending','sent','failed')
       and created_at >= date_trunc('day',now() at time zone 'Europe/Riga') at time zone 'Europe/Riga';
    perform meets_private.queue_email(p_kind,s.id,v_admin,p_subject,p_heading,
      meets_private.submission_summary(s)||jsonb_build_array(jsonb_build_array('Iesniedza',v_author)),
      p_note,'Atvērt pārbaudei',meets_private.setting('site_url')||'/admin?submission='||s.id,v_author,
      case when p_kind='admin_auto_published' or v_sent>=v_limit then 'held' else 'queued' end);
  end loop;
end $$;
drop function if exists meets_private.notify_admins(text,public.meets_submissions,text,text);

create or replace function meets_private.submission_after_write()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_author text; v_action text; v_blockers text[]; v_trusted boolean; v_result jsonb; s public.meets_submissions%rowtype;
begin
  if meets_private.is_meets_admin() then return new; end if;
  if new.status<>'pending_review' then return new; end if;

  if tg_op='INSERT' or old.status is distinct from 'pending_review' then
    v_action := case when tg_op='UPDATE' and old.status='rejected' then 'resubmitted' else 'submitted' end;
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
      case when v_action='resubmitted' then 'Organizators izlaboja pasākumu un iesniedza to atkārtoti' else 'Saņemts jauns pasākums pārbaudei' end,
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
end $$;

-- Daily summary: pending queue, what came in since the last summary, auto-published.
create or replace function meets_private.send_admin_digest()
returns integer language plpgsql security definer set search_path to '' as $$
declare
  v_admin text; v_sent int:=0; v_pending int; v_oldest int; v_held int; v_auto int; v_noplace int; v_list text;
  v_today date:=(now() at time zone 'Europe/Riga')::date;
begin
  select count(*),coalesce(max(v_today-(coalesce(submitted_at,created_at) at time zone 'Europe/Riga')::date),0)
    into v_pending,v_oldest from public.meets_submissions where status='pending_review';
  select string_agg('• '||title||' ('||to_char(date_from,'DD.MM.')||', '||coalesce(nullif(venue_name,''),'vieta nav norādīta')||')',E'\n' order by coalesce(submitted_at,created_at))
    into v_list from (select * from public.meets_submissions where status='pending_review' order by coalesce(submitted_at,created_at) limit 10) p;
  select count(*) into v_noplace from public.events e left join public.event_locations l on l.event_id=e.id
   where e.status='pending_review' and e.date_from between v_today and v_today+7 and coalesce(l.location_quality,'')<>'verified_exact';
  for v_admin in select email from meets_private.admin_email_allowlist loop
    select count(*) filter(where kind<>'admin_auto_published'),count(*) filter(where kind='admin_auto_published')
      into v_held,v_auto from meets_private.email_outbox where to_email=v_admin and status='held';
    if v_pending=0 and v_held=0 and v_auto=0 then continue; end if;
    perform meets_private.queue_email('admin_digest',null,v_admin,
      'MEETS kopsavilkums: '||v_pending||' gaida pārbaudi',
      'Kopsavilkums '||to_char(v_today,'DD.MM.YYYY'),
      jsonb_build_array(
        jsonb_build_array('Gaida pārbaudi',v_pending::text||case when v_pending>0 then ' (vecākais '||v_oldest||' d.)' else '' end),
        jsonb_build_array('Jauni vai laboti kopš pēdējās ziņas',nullif(v_held,0)::text),
        jsonb_build_array('Automātiski publicēti',nullif(v_auto,0)::text),
        jsonb_build_array('Tuvāko 7 dienu pasākumi bez vietas',nullif(v_noplace,0)::text)),
      case when v_list is not null then 'Gaida pārbaudi:'||E'\n'||v_list end,
      'Atvērt admin vidi',meets_private.setting('site_url')||'/admin');
    update meets_private.email_outbox set status='digested' where to_email=v_admin and status='held';
    v_sent:=v_sent+1;
  end loop;
  return v_sent;
end $$;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname='meets-admin-digest';
  -- 06:07 UTC = 08:07 (winter) / 09:07 (summer) in Riga.
  perform cron.schedule('meets-admin-digest','7 6 * * *','select meets_private.send_admin_digest();');
end $$;

-- 4. Admin RPCs ---------------------------------------------------------------
-- Organizers with their track record; "suggested" = 3+ published, nothing
-- declined or sent back in the last 90 days.
create or replace function public.meets_admin_organizations(p_session_token text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.trusted desc,x.published desc,x.name) from (
    select o.id,o.name,u.email as owner_email,t.organization_id is not null as trusted,t.trusted_at,
      count(s.id) filter(where s.status='published') as published,
      count(s.id) filter(where s.status='pending_review') as pending,
      count(s.id) filter(where s.status='declined') as declined,
      (select count(*) from meets_private.submission_events e join public.meets_submissions s2 on s2.id=e.submission_id
        where s2.organization_id=o.id and e.action='changes_requested') as changes_requested,
      max(coalesce(s.submitted_at,s.created_at)) as last_submitted_at,
      t.organization_id is null
        and count(s.id) filter(where s.status='published')>=3
        and not exists(select 1 from meets_private.submission_events e join public.meets_submissions s3 on s3.id=e.submission_id
          where s3.organization_id=o.id and e.action in ('changes_requested','declined') and e.created_at>now()-interval '90 days') as suggested
    from public.meets_organizations o
    left join auth.users u on u.id=o.owner_id
    left join meets_private.trusted_organizations t on t.organization_id=o.id
    left join public.meets_submissions s on s.organization_id=o.id and s.status<>'draft'
    group by o.id,o.name,u.email,t.organization_id,t.trusted_at
  ) x),'[]'::jsonb);
end $$;
revoke execute on function public.meets_admin_organizations(text) from public,anon;
grant execute on function public.meets_admin_organizations(text) to authenticated;

create or replace function public.meets_admin_set_organization_trust(p_session_token text, p_organization_id uuid, p_trusted boolean)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  if p_trusted then
    insert into meets_private.trusted_organizations(organization_id,trusted_by) values(p_organization_id,auth.uid())
    on conflict do nothing;
  else
    delete from meets_private.trusted_organizations where organization_id=p_organization_id;
  end if;
  return jsonb_build_object('organization_id',p_organization_id,'trusted',p_trusted);
end $$;
revoke execute on function public.meets_admin_set_organization_trust(text,uuid,boolean) from public,anon;
grant execute on function public.meets_admin_set_organization_trust(text,uuid,boolean) to authenticated;

create or replace function public.meets_admin_email_status(p_session_token text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return jsonb_build_object(
    'sent_7d',(select count(*) from meets_private.email_outbox where status='sent' and created_at>now()-interval '7 days'),
    'waiting',(select count(*) from meets_private.email_outbox where status in ('queued','sending')),
    'held',(select count(*) from meets_private.email_outbox where status='held'),
    'failed',(select count(*) from meets_private.email_outbox where status='failed' and created_at>now()-interval '7 days'),
    'last_error',(select error from meets_private.email_outbox where status='failed' order by id desc limit 1));
end $$;
