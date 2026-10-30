-- Organizer submissions: structured review (publish / request changes / decline
-- with a reason), a review history, e-mail notifications through Resend, and
-- known-place matching by name for faster locations.

create extension if not exists pg_trgm with schema extensions;

-- 1. Review fields ----------------------------------------------------------
alter table public.meets_submissions
  add column if not exists review_reason text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists submitted_at timestamptz;

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid='public.meets_submissions'::regclass and contype='c'
     and pg_get_constraintdef(oid) like '%pending_review%rejected%';
  if c is not null then execute format('alter table public.meets_submissions drop constraint %I',c); end if;
end $$;
alter table public.meets_submissions add constraint meets_submissions_status_check
  check (status in ('draft','pending_review','published','rejected','declined'));

update public.meets_submissions set submitted_at=coalesce(submitted_at,updated_at,created_at)
 where status<>'draft' and submitted_at is null;

-- What happened to a submission, newest last; shown to admins.
create table if not exists meets_private.submission_events(
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.meets_submissions(id) on delete cascade,
  action text not null check (action in ('submitted','resubmitted','updated','published','changes_requested','declined')),
  reason text,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists submission_events_submission_idx on meets_private.submission_events(submission_id,created_at);
revoke all on meets_private.submission_events from public,anon,authenticated;

-- Reason codes; the labels live in lib/submission-review.js.
create or replace function meets_private.submission_reason_label(p_reason text)
returns text language sql immutable set search_path to '' as $$
  select case p_reason
    when 'location' then 'Jāprecizē norises vieta vai adrese'
    when 'datetime' then 'Jāprecizē datums vai laiks'
    when 'description' then 'Jāpapildina apraksts'
    when 'price' then 'Jāprecizē cena vai biļešu informācija'
    when 'image' then 'Jānomaina attēls'
    when 'duplicate' then 'Pasākums MEETS jau ir publicēts'
    when 'not_public' then 'Pasākums nav publiski apmeklējams'
    when 'past' then 'Pasākums jau ir noticis'
    when 'out_of_scope' then 'Neatbilst MEETS pasākumu kritērijiem'
    when 'spam' then 'Reklāma vai nekorekts saturs'
    when 'other' then 'Cits iemesls'
    else null end
$$;

-- 2. E-mail outbox ----------------------------------------------------------
create table if not exists meets_private.app_settings(
  key text primary key,
  value text not null
);
revoke all on meets_private.app_settings from public,anon,authenticated;
insert into meets_private.app_settings(key,value) values
  ('email_from','MEETS <noreply@meets.lv>'),
  ('site_url','https://www.meets.lv')
on conflict do nothing;

create table if not exists meets_private.email_outbox(
  id bigint generated always as identity primary key,
  kind text not null,
  submission_id uuid references public.meets_submissions(id) on delete set null,
  to_email text not null,
  reply_to text,
  subject text not null,
  html text not null,
  body_text text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts integer not null default 0,
  request_id bigint,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_outbox_status_idx on meets_private.email_outbox(status,created_at);
revoke all on meets_private.email_outbox from public,anon,authenticated;

create or replace function meets_private.html_escape(p text)
returns text language sql immutable set search_path to '' as $$
  select replace(replace(replace(replace(coalesce(p,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;')
$$;

create or replace function meets_private.setting(p_key text)
returns text language sql stable security definer set search_path to '' as $$
  select value from meets_private.app_settings where key=p_key
$$;

-- Builds a short e-mail: heading, key/value lines, optional note and a button.
create or replace function meets_private.queue_email(
  p_kind text, p_submission uuid, p_to text, p_subject text, p_heading text,
  p_lines jsonb, p_note text, p_button_label text, p_button_url text, p_reply_to text default null)
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
  insert into meets_private.email_outbox(kind,submission_id,to_email,reply_to,subject,html,body_text)
  values(p_kind,p_submission,lower(trim(p_to)),p_reply_to,left(p_subject,200),v_html,v_text);
end $$;

-- Sends queued mail through Resend and settles earlier requests (pg_net is async).
create or replace function meets_private.email_outbox_tick()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_key text; v_from text; v_row record; v_resp record; v_sent int:=0; v_queued int:=0;
begin
  if not pg_try_advisory_xact_lock(201030,1500) then return jsonb_build_object('state','busy'); end if;
  for v_row in select * from meets_private.email_outbox where status='sending' for update skip locked loop
    select status_code,error_msg,content into v_resp from net._http_response where id=v_row.request_id;
    if v_resp is null then
      if v_row.sent_at < now()-interval '30 minutes' then
        update meets_private.email_outbox set status=case when attempts>=3 then 'failed' else 'queued' end,
          error='Nav atbildes no e-pasta servisa' where id=v_row.id;
      end if;
    elsif v_resp.status_code between 200 and 299 then
      update meets_private.email_outbox set status='sent',error=null where id=v_row.id;
      v_sent:=v_sent+1;
    else
      update meets_private.email_outbox set status=case when attempts>=3 then 'failed' else 'queued' end,
        error=left(coalesce(v_resp.error_msg,'')||' '||coalesce(v_resp.status_code::text,'')||' '||coalesce(v_resp.content,''),500)
       where id=v_row.id;
    end if;
  end loop;

  select decrypted_secret into v_key from vault.decrypted_secrets where name='meets_resend_api_key';
  if v_key is null then return jsonb_build_object('state','no_key'); end if;
  v_from := coalesce(meets_private.setting('email_from'),'MEETS <noreply@meets.lv>');
  for v_row in select * from meets_private.email_outbox where status='queued' order by id limit 20 for update skip locked loop
    update meets_private.email_outbox set status='sending',attempts=attempts+1,sent_at=now(),
      request_id=net.http_post(
        url:='https://api.resend.com/emails',
        body:=jsonb_strip_nulls(jsonb_build_object('from',v_from,'to',jsonb_build_array(v_row.to_email),
          'subject',v_row.subject,'html',v_row.html,'text',v_row.body_text,'reply_to',v_row.reply_to)),
        headers:=jsonb_build_object('Authorization','Bearer '||v_key,'Content-Type','application/json'),
        timeout_milliseconds:=10000)
     where id=v_row.id;
    v_queued:=v_queued+1;
  end loop;
  return jsonb_build_object('settled',v_sent,'sending',v_queued);
end $$;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname='meets-email-outbox';
  perform cron.schedule('meets-email-outbox','* * * * *','select meets_private.email_outbox_tick();');
end $$;

-- 3. Notifications for organizer actions -----------------------------------
create or replace function meets_private.submission_summary(s public.meets_submissions)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_array(
    jsonb_build_array('Pasākums',s.title),
    jsonb_build_array('Organizators',(select o.name from public.meets_organizations o where o.id=s.organization_id)),
    jsonb_build_array('Datums',to_char(s.date_from,'DD.MM.YYYY')
      ||case when s.date_to is not null and s.date_to<>s.date_from then '–'||to_char(s.date_to,'DD.MM.YYYY') else '' end
      ||coalesce(' '||to_char(s.time_from,'HH24:MI'),'')),
    jsonb_build_array('Vieta',concat_ws(', ',nullif(s.venue_name,''),nullif(s.address,''))))
$$;

create or replace function meets_private.notify_admins(p_kind text, s public.meets_submissions, p_subject text, p_heading text)
returns void language plpgsql security definer set search_path to '' as $$
declare v_admin text; v_author text;
begin
  select email into v_author from auth.users where id=s.author_id;
  for v_admin in select email from meets_private.admin_email_allowlist loop
    perform meets_private.queue_email(p_kind,s.id,v_admin,p_subject,p_heading,
      meets_private.submission_summary(s)||jsonb_build_array(jsonb_build_array('Iesniedza',v_author)),
      null,'Atvērt pārbaudei',meets_private.setting('site_url')||'/admin?submission='||s.id,v_author);
  end loop;
end $$;

create or replace function meets_private.submission_before_write()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.status='pending_review' and (tg_op='INSERT' or old.status is distinct from 'pending_review') then
    new.submitted_at := now();
    new.review_reason := null;
  end if;
  return new;
end $$;

create or replace function meets_private.submission_after_write()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_author text; v_action text;
begin
  -- Admin decisions send their own messages (they carry the reason).
  if meets_private.is_meets_admin() then return new; end if;
  if new.status<>'pending_review' then return new; end if;

  if tg_op='INSERT' or old.status is distinct from 'pending_review' then
    v_action := case when tg_op='UPDATE' and old.status='rejected' then 'resubmitted' else 'submitted' end;
    insert into meets_private.submission_events(submission_id,action,actor_id) values(new.id,v_action,auth.uid());
    perform meets_private.notify_admins('admin_'||v_action,new,
      case when v_action='resubmitted' then 'Labots pasākums atkal gaida pārbaudi: ' else 'Jauns pasākums pārbaudei: ' end||new.title,
      case when v_action='resubmitted' then 'Organizators izlaboja pasākumu un iesniedza to atkārtoti' else 'Saņemts jauns pasākums pārbaudei' end);
    select email into v_author from auth.users where id=new.author_id;
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
    -- One message per half hour while an organizer keeps editing.
    if not exists(select 1 from meets_private.email_outbox where submission_id=new.id and kind like 'admin_%' and created_at>now()-interval '30 minutes') then
      perform meets_private.notify_admins('admin_updated',new,'Pārbaudāmais pasākums labots: '||new.title,'Organizators laboja pasākumu, kas gaida pārbaudi');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists meets_submission_before_write on public.meets_submissions;
create trigger meets_submission_before_write before insert or update on public.meets_submissions
  for each row execute function meets_private.submission_before_write();
drop trigger if exists meets_submission_after_write on public.meets_submissions;
create trigger meets_submission_after_write after insert or update on public.meets_submissions
  for each row execute function meets_private.submission_after_write();

-- 4. Admin review ------------------------------------------------------------
create or replace function public.meets_admin_review_submission_v3(
  p_session_token text, p_id uuid, p_action text, p_reason text default null, p_note text default '',
  p_latitude double precision default null, p_longitude double precision default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_result jsonb; s public.meets_submissions%rowtype; v_author text; v_note text:=left(btrim(coalesce(p_note,'')),1000);
  v_label text:=meets_private.submission_reason_label(p_reason); v_site text:=meets_private.setting('site_url');
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  if p_action not in ('publish','request_changes','decline') then raise exception 'Nezināma darbība'; end if;
  if p_action='request_changes' and p_reason not in ('location','datetime','description','price','image','other') then
    raise exception 'Izvēlies, kas jāprecizē'; end if;
  if p_action='decline' and p_reason not in ('duplicate','not_public','past','out_of_scope','spam','other') then
    raise exception 'Izvēlies noraidīšanas iemeslu'; end if;
  if p_reason='other' and v_note='' then raise exception 'Pie iemesla “Cits” uzraksti komentāru'; end if;

  if p_action='publish' then
    v_result := public.meets_admin_review_submission_v2(p_session_token,p_id,true,v_note,p_latitude,p_longitude);
  elsif p_action='request_changes' then
    v_result := public.meets_admin_review_submission_v2(p_session_token,p_id,false,v_note,null,null);
  else
    update public.meets_submissions set status='declined',admin_note=v_note,updated_at=now()
     where id=p_id and status='pending_review';
    if not found then raise exception 'Submission not pending'; end if;
    v_result := jsonb_build_object('status','declined');
  end if;

  update public.meets_submissions set review_reason=case when p_action='publish' then null else p_reason end,
    reviewed_at=now(),reviewed_by=auth.uid() where id=p_id returning * into s;
  insert into meets_private.submission_events(submission_id,action,reason,note,actor_id)
  values(p_id,case p_action when 'publish' then 'published' when 'request_changes' then 'changes_requested' else 'declined' end,
    p_reason,nullif(v_note,''),auth.uid());

  select email into v_author from auth.users where id=s.author_id;
  if p_action='publish' then
    perform meets_private.queue_email('organizer_published',s.id,v_author,'Pasākums publicēts: '||s.title,
      'Tavs pasākums ir publicēts MEETS',meets_private.submission_summary(s)
        ||case when (v_result->>'occurrences')::int>1 then jsonb_build_array(jsonb_build_array('Norises reizes',v_result->>'occurrences')) else '[]'::jsonb end,
      nullif(v_note,''),'Skatīt pasākumu',v_site||'/pasakumi/'||s.event_id);
  elsif p_action='request_changes' then
    perform meets_private.queue_email('organizer_changes',s.id,v_author,'Lūdzam precizēt pasākumu: '||s.title,
      'Pirms publicēšanas lūdzam precizēt informāciju',
      meets_private.submission_summary(s)||jsonb_build_array(jsonb_build_array('Kas jāprecizē',v_label)),
      nullif(v_note,''),'Labot un iesniegt',v_site||'/registre-pasakumu/vienkarsi?org='||s.organization_id||'&edit='||s.id);
  else
    perform meets_private.queue_email('organizer_declined',s.id,v_author,'Pasākums netika publicēts: '||s.title,
      'Šo pasākumu MEETS nepublicēs',
      meets_private.submission_summary(s)||jsonb_build_array(jsonb_build_array('Iemesls',v_label)),
      nullif(v_note,''),'Atvērt organizatora vidi',v_site||'/organizators?org='||s.organization_id);
  end if;
  return v_result||jsonb_build_object('reason',p_reason);
end $$;
revoke execute on function public.meets_admin_review_submission_v3(text,uuid,text,text,text,double precision,double precision) from public,anon;
grant execute on function public.meets_admin_review_submission_v3(text,uuid,text,text,text,double precision,double precision) to authenticated;

-- Submissions for the admin queue, with history, contact and possible duplicates.
create or replace function public.meets_admin_user_submissions(p_session_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select s.id,s.organization_id,s.title,s.description,s.category,s.date_from,s.date_to,s.time_from,s.time_to,
      s.venue_name,s.address,s.latitude,s.longitude,s.status,s.admin_note,s.event_id,s.created_at,s.updated_at,
      s.price_status,s.price_min,s.price_max,s.schedule_kind,s.recurrence_slots,s.cover_image_path,s.venue_id,
      s.review_reason,s.reviewed_at,coalesce(s.submitted_at,s.created_at) as submitted_at,
      o.name as organization_name,u.email as author_email,
      (select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'reason',e.reason,'note',e.note,'at',e.created_at) order by e.created_at),'[]'::jsonb)
         from meets_private.submission_events e where e.submission_id=s.id) as history,
      (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'date_from',v.date_from,'venue_name',v.venue_name)),'[]'::jsonb)
         from (select ev.id,ev.title,ev.date_from,l.venue_name from public.events ev
                 left join public.event_locations l on l.event_id=ev.id
                where s.status='pending_review' and ev.status in ('published','pending_review')
                  and ev.date_from between s.date_from-1 and coalesce(s.date_to,s.date_from)+1
                  and extensions.similarity(lower(ev.title),lower(s.title))>0.45
                  and ev.import_key is distinct from 'meets-user:'||s.id
                order by extensions.similarity(lower(ev.title),lower(s.title)) desc limit 3) v) as possible_duplicates
    from public.meets_submissions s
    join public.meets_organizations o on o.id=s.organization_id
    left join auth.users u on u.id=s.author_id
    where s.status in ('pending_review','rejected','published','declined')
  ) x),'[]'::jsonb);
end $$;

-- 5. Known places by name ----------------------------------------------------
create index if not exists event_locations_venue_trgm on public.event_locations
  using gin (lower(venue_name) extensions.gin_trgm_ops) where location_quality='verified_exact';
create index if not exists location_alias_trgm on meets_private.location_alias_mappings
  using gin (lower(alias_text) extensions.gin_trgm_ops) where active;

-- For each {key,name,municipality} returns up to 3 places MEETS already knows
-- (saved mappings, organizer venues, verified event locations), best first.
create or replace function public.meets_admin_match_places(p_session_token text, p_places jsonb)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_place jsonb; v_out jsonb:='[]'::jsonb; v_name text; v_matches jsonb;
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  if jsonb_typeof(p_places)<>'array' or jsonb_array_length(p_places)>60 then raise exception 'Ne vairāk kā 60 vietas vienā pieprasījumā'; end if;
  perform set_config('pg_trgm.similarity_threshold','0.4',true);
  for v_place in select value from jsonb_array_elements(p_places) loop
    v_name := lower(btrim(coalesce(v_place->>'name','')));
    if length(v_name)<3 then continue; end if;
    select coalesce(jsonb_agg(m order by (m->>'score')::numeric desc),'[]'::jsonb) into v_matches from (
      select jsonb_build_object('label',c.label,'displayName',c.address,'latitude',c.lat,'longitude',c.lon,
        'source',c.source,'type','meets_known','category','meets','score',round(c.score::numeric,2)) m
      from (
        select distinct on (round(lat::numeric,4),round(lon::numeric,4)) * from (
          select a.canonical_venue_name label,coalesce(a.canonical_address_text,a.canonical_venue_name) address,
                 a.latitude lat,a.longitude lon,'Saglabāts mapping' source,
                 extensions.similarity(lower(a.alias_text),v_name)+0.05 score
            from meets_private.location_alias_mappings a
           where a.active and a.latitude is not null and lower(a.alias_text) operator(extensions.%) v_name
          union all
          select v.name,coalesce(v.address,v.name),v.latitude,v.longitude,'Organizatora vieta',
                 extensions.similarity(lower(v.name),v_name)
            from public.meets_venues v
           where v.latitude is not null and lower(v.name) operator(extensions.%) v_name
          union all
          select l.venue_name,coalesce(l.address_raw,l.venue_name),
                 extensions.st_y(l.map_point::extensions.geometry),extensions.st_x(l.map_point::extensions.geometry),
                 'Pārbaudīta pasākuma vieta',extensions.similarity(lower(l.venue_name),v_name)
            from public.event_locations l
           where l.location_quality='verified_exact' and l.map_point is not null
             and lower(l.venue_name) operator(extensions.%) v_name
        ) all_matches
        order by round(lat::numeric,4),round(lon::numeric,4),score desc
      ) c
      order by c.score desc limit 3
    ) best;
    if jsonb_array_length(v_matches)>0 then
      v_out := v_out||jsonb_build_array(jsonb_build_object('key',v_place->'key','matches',v_matches));
    end if;
  end loop;
  return v_out;
end $$;
revoke execute on function public.meets_admin_match_places(text,jsonb) from public,anon;
grant execute on function public.meets_admin_match_places(text,jsonb) to authenticated;

-- Admins can see whether mail goes out.
create or replace function public.meets_admin_email_status(p_session_token text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return jsonb_build_object(
    'sent_7d',(select count(*) from meets_private.email_outbox where status='sent' and created_at>now()-interval '7 days'),
    'waiting',(select count(*) from meets_private.email_outbox where status in ('queued','sending')),
    'failed',(select count(*) from meets_private.email_outbox where status='failed' and created_at>now()-interval '7 days'),
    'last_error',(select error from meets_private.email_outbox where status='failed' order by id desc limit 1));
end $$;
revoke execute on function public.meets_admin_email_status(text) from public,anon;
grant execute on function public.meets_admin_email_status(text) to authenticated;
