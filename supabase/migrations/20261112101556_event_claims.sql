-- "Tas ir mans pasākums": an organizer claims an imported event. After an admin
-- approves, the event becomes a published submission of that organizer: the
-- catalogue shows the organizer, and the organizer can add a picture, text and
-- price in the organizer workspace like for any own event. When the organizer's
-- edit is published, publish_submission makes the organizer's version the public
-- one and cancels the imported copy.

create table if not exists public.meets_event_claims(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.meets_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null default '' check (length(message)<=1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text not null default '' check (length(admin_note)<=1000),
  submission_id uuid references public.meets_submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create unique index if not exists meets_event_claims_one_pending
  on public.meets_event_claims(event_id,organization_id) where status='pending';
create index if not exists meets_event_claims_event on public.meets_event_claims(event_id);
create index if not exists meets_event_claims_organization on public.meets_event_claims(organization_id);
alter table public.meets_event_claims enable row level security;
-- Read and written only through the functions below.
revoke all on public.meets_event_claims from public,anon,authenticated;

-- Whether an event may be claimed: published, imported (not an organizer's own
-- event) and not yet given to an organizer.
create or replace function meets_private.event_claimable(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists(
    select 1 from public.events e
     where e.id=p_event and e.status='published'
       and coalesce(e.import_key,'') not like 'meets-user:%'
       and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date
       and not exists(select 1 from public.meets_published_occurrences o where o.event_id=e.id))
$$;

-- The signed-in organizer asks for an event.
create or replace function public.meets_claim_event(p_event uuid, p_org uuid, p_message text default '')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Lūdzu, pieslēdzies.' using errcode='42501'; end if;
  if not public.meets_org_can_edit(p_org) then
    raise exception 'Pieteikt pasākumu var tikai rīkotāja īpašnieks, administrators vai rīkotājs.' using errcode='42501';
  end if;
  if not meets_private.event_claimable(p_event) then
    raise exception 'Šo pasākumu nevar pieteikt: tas jau pieder rīkotājam vai vairs nav aktuāls.' using errcode='22023';
  end if;
  if (select count(*) from public.meets_event_claims c where c.organization_id=p_org and c.status='pending')>=50 then
    raise exception 'Rīkotājam jau ir 50 neizskatīti pieteikumi.' using errcode='22023';
  end if;
  insert into public.meets_event_claims(event_id,organization_id,user_id,message)
  values(p_event,p_org,auth.uid(),left(btrim(coalesce(p_message,'')),1000))
  on conflict (event_id,organization_id) where status='pending' do update set message=excluded.message
  returning id into v_id;
  return jsonb_build_object('id',v_id,'status','pending');
end
$$;

-- An organizer's claims (any member may read them).
create or replace function public.meets_org_event_claims(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.meets_org_can_read(p_org) then raise exception 'Nav piekļuves.' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'event_id',c.event_id,'title',e.title,'date_from',e.date_from,
            'status',c.status,'admin_note',c.admin_note,'submission_id',c.submission_id,'created_at',c.created_at) order by c.created_at desc),'[]'::jsonb)
            from public.meets_event_claims c join public.events e on e.id=c.event_id where c.organization_id=p_org);
end
$$;

-- Admin: claims to review, the newest first, with the last 30 days of decisions.
create or replace function public.meets_admin_event_claims(p_session_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(x order by (x->>'status')='pending' desc,(x->>'created_at') desc),'[]'::jsonb) from (
    select jsonb_build_object('id',c.id,'status',c.status,'message',c.message,'admin_note',c.admin_note,'created_at',c.created_at,
      'decided_at',c.decided_at,'event_id',c.event_id,'title',e.title,'date_from',e.date_from,'venue_name',l.venue_name,
      'source_url',(select es.source_url from public.event_sources es where es.event_id=e.id order by es.id limit 1),
      'organization_id',o.id,'organization_name',o.name,'organization_public',o.is_public,
      'user_email',u.email,'claimable',meets_private.event_claimable(c.event_id)) x
      from public.meets_event_claims c
      join public.events e on e.id=c.event_id
      left join public.event_locations l on l.event_id=e.id
      join public.meets_organizations o on o.id=c.organization_id
      left join auth.users u on u.id=c.user_id
     where c.status='pending' or c.decided_at>now()-interval '30 days') q);
end
$$;

-- Admin decides. Approval copies the event into a published submission of the
-- organizer and links them; other pending claims for the event are closed.
create or replace function public.meets_admin_decide_event_claim(p_session_token text, p_claim uuid, p_approve boolean, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  c public.meets_event_claims%rowtype;
  e public.events%rowtype;
  l public.event_locations%rowtype;
  s public.meets_submissions%rowtype;
  v_note text := left(btrim(coalesce(p_note,'')),1000);
  v_email text;
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  select * into c from public.meets_event_claims where id=p_claim for update;
  if not found or c.status<>'pending' then raise exception 'Pieteikums jau ir izskatīts.' using errcode='22023'; end if;
  select email into v_email from auth.users where id=c.user_id;

  if not p_approve then
    update public.meets_event_claims set status='rejected',admin_note=v_note,decided_at=now(),decided_by=auth.uid() where id=c.id;
    return jsonb_build_object('status','rejected');
  end if;

  if not meets_private.event_claimable(c.event_id) then
    raise exception 'Pasākumu vairs nevar piešķirt: tas jau pieder rīkotājam vai vairs nav aktuāls.' using errcode='22023';
  end if;
  select * into e from public.events where id=c.event_id for update;
  select * into l from public.event_locations where event_id=c.event_id;

  insert into public.meets_submissions(organization_id,author_id,title,description,category,date_from,date_to,time_from,time_to,
    venue_name,address,latitude,longitude,price_status,price_min,price_max,status,event_id,schedule_kind,attendance_mode,
    visibility,submitted_at,reviewed_at,reviewed_by,admin_note)
  values(c.organization_id,c.user_id,left(btrim(e.title),200),coalesce(e.description,''),left(coalesce(nullif(e.primary_category,''),'Cits'),100),
    e.date_from,case when e.date_to>=e.date_from then e.date_to end,e.time_from,e.time_to,
    left(coalesce(l.venue_name,''),200),left(coalesce(l.address_raw,l.venue_name,''),300),
    extensions.st_y(l.map_point::extensions.geometry),extensions.st_x(l.map_point::extensions.geometry),
    coalesce(e.price_status,'unknown'),e.price_min,case when e.price_max>=coalesce(e.price_min,0) then e.price_max end,
    'published',e.id,'once',case when e.attendance_mode in ('online','hybrid') then e.attendance_mode else 'in_person' end,
    'public',now(),now(),auth.uid(),'Pārņemts no importēta pasākuma; rīkotāja pieteikums apstiprināts.')
  returning * into s;
  insert into public.meets_published_occurrences(submission_id,event_id,venue_id) values(s.id,e.id,null)
  on conflict (event_id) do nothing;

  update public.meets_event_claims set status='approved',admin_note=v_note,submission_id=s.id,decided_at=now(),decided_by=auth.uid() where id=c.id;
  update public.meets_event_claims set status='rejected',admin_note='Pasākums piešķirts citam rīkotājam.',decided_at=now(),decided_by=auth.uid()
   where event_id=c.event_id and status='pending' and id<>c.id;

  if v_email is not null then
    perform meets_private.queue_email('organizer_published',s.id,v_email,'Pasākums piešķirts: '||s.title,
      'Pasākums tagad ir tavā rīkotāja vidē',meets_private.submission_summary(s),
      'Pievieno attēlu, aprakstu un cenu. Kad saglabāsi izmaiņas, tās tiks pārbaudītas un publicētas.',
      'Atvērt rīkotāja vidi',meets_private.setting('site_url')||'/organizators?org='||c.organization_id);
  end if;
  return jsonb_build_object('status','approved','submission_id',s.id);
end
$$;

-- An imported event that its organizer's own version replaced (cancelled by
-- publish_submission), or that ended, is not published again by the next import.
create or replace function meets_private.import_publish_if_ready(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text;
  v_check jsonb;
begin
  select status into v_status from public.events where id=p_event_id;
  if v_status is null then
    raise exception 'Event not found' using errcode='P0002';
  end if;
  if v_status in ('cancelled','archived') then
    return jsonb_build_object('published',false,'status',v_status);
  end if;

  v_check:=meets_private.event_publishability(p_event_id);

  if coalesce((v_check->>'allowed')::boolean,false) then
    if v_status<>'published' then
      update public.events
         set status='published',
             review_status='approved',
             updated_at=now(),
             last_change_summary='Import publication after location quality validation'
       where id=p_event_id;
      return jsonb_build_object('published',true,'status','published');
    end if;

    return jsonb_build_object('published',true,'status','already_published');
  end if;

  if v_status='published' then
    update public.events
       set status='pending_review',
           review_status='needs_review',
           updated_at=now(),
           last_change_summary='Import changed data; published event requires location revalidation'
     where id=p_event_id;

    return jsonb_build_object(
      'published',false,
      'status','returned_to_review',
      'reason',v_check->>'reason'
    );
  end if;

  return jsonb_build_object(
    'published',false,
    'status','pending_review',
    'reason',v_check->>'reason'
  );
end
$function$;

-- When the organizer's own version of a claimed event is published, the imported
-- copy linked to the same submission is cancelled, so the event is listed once.
-- (publish_submission creates the organizer's event under 'meets-user:<submission>'.)
create or replace function meets_private.retire_claimed_import_after_publish()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if exists(select 1 from public.events e where e.id=new.event_id and e.import_key like 'meets-user:'||new.submission_id::text||'%') then
    update public.events e
       set status='cancelled',updated_at=now(),last_change_summary='Aizstāts ar rīkotāja publicēto versiju'
     where e.status<>'cancelled'
       and coalesce(e.import_key,'') not like 'meets-user:%'
       and e.id in (select o.event_id from public.meets_published_occurrences o where o.submission_id=new.submission_id);
  end if;
  return new;
end
$$;
create or replace trigger retire_claimed_import_after_publish
  after insert or update on public.meets_published_occurrences
  for each row execute function meets_private.retire_claimed_import_after_publish();

revoke execute on function meets_private.retire_claimed_import_after_publish() from public,anon,authenticated;
revoke execute on function meets_private.event_claimable(uuid) from public,anon,authenticated;
revoke execute on function public.meets_claim_event(uuid,uuid,text) from public,anon;
revoke execute on function public.meets_org_event_claims(uuid) from public,anon;
revoke execute on function public.meets_admin_event_claims(text) from public,anon;
revoke execute on function public.meets_admin_decide_event_claim(text,uuid,boolean,text) from public,anon;
grant execute on function public.meets_claim_event(uuid,uuid,text) to authenticated;
grant execute on function public.meets_org_event_claims(uuid) to authenticated;
grant execute on function public.meets_admin_event_claims(text) to authenticated;
grant execute on function public.meets_admin_decide_event_claim(text,uuid,boolean,text) to authenticated;
