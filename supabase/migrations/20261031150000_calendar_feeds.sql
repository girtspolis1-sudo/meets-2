-- Calendar feeds (.ics): an admin adds a feed's link in Admin → Avoti; the
-- sync-calendar-feeds edge function reads every active feed daily (or one feed on
-- "Ielādēt tagad"). Failed feeds appear in the daily digest.

create table if not exists meets_private.calendar_feeds(
  id bigint generated always as identity primary key,
  url text not null unique check (url ~ '^https?://'),
  label text not null check (length(btrim(label)) between 2 and 120),
  municipality_id bigint references public.municipalities(id),
  source_id bigint references public.sources(id),
  default_category text,
  active boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  last_found integer,
  last_created integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on meets_private.calendar_feeds from public,anon,authenticated;

-- Edge function interface (service role only).
create or replace function public.meets_calendar_feeds_for_sync(p_feed_id bigint default null)
returns jsonb
language sql
stable security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'url',f.url,'label',f.label,'municipality_id',f.municipality_id,
           'source_id',f.source_id,'default_category',f.default_category) order by f.id),'[]'::jsonb)
    from meets_private.calendar_feeds f
   where (p_feed_id is null and f.active) or f.id=p_feed_id
$$;

create or replace function public.meets_calendar_feed_finished(p_feed_id bigint, p_status text, p_found integer, p_created integer, p_error text, p_source_id bigint)
returns void
language sql
security definer
set search_path to ''
as $$
  update meets_private.calendar_feeds
     set last_run_at=now(),last_status=p_status,last_error=p_error,
         last_found=coalesce(p_found,last_found),last_created=coalesce(p_created,last_created),
         source_id=coalesce(source_id,p_source_id)
   where id=p_feed_id;
$$;

revoke execute on function public.meets_calendar_feeds_for_sync(bigint) from public,anon,authenticated;
revoke execute on function public.meets_calendar_feed_finished(bigint,text,integer,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.meets_calendar_feeds_for_sync(bigint) to service_role;
grant execute on function public.meets_calendar_feed_finished(bigint,text,integer,integer,text,bigint) to service_role;

create or replace function meets_private.run_calendar_feeds(p_feed_id bigint default null)
returns bigint
language sql
security definer
set search_path to ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='meets_project_url')||'/functions/v1/sync-calendar-feeds',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='meets_publishable_key')),
    body := jsonb_build_object('feedId',p_feed_id), timeout_milliseconds := 150000)
$$;

-- Admin: the feeds with their last result and upcoming events, and the municipalities to choose from.
create or replace function meets_private.admin_calendar_feeds(p_session_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return jsonb_build_object(
    'feeds',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',f.id,'url',f.url,'label',f.label,'municipality_id',f.municipality_id,'municipality',m.name,
        'default_category',f.default_category,'active',f.active,'last_run_at',f.last_run_at,'last_status',f.last_status,
        'last_error',f.last_error,'last_found',f.last_found,'last_created',f.last_created,
        'upcoming',(select count(*) from public.events e where e.import_key like 'ics:'||f.id||':%'
                      and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date),
        'published',(select count(*) from public.events e where e.import_key like 'ics:'||f.id||':%' and e.status='published'
                      and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date)
      ) order by f.label),'[]'::jsonb)
      from meets_private.calendar_feeds f left join public.municipalities m on m.id=f.municipality_id),
    'municipalities',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb)
      from public.municipalities where name ~ ' (novads|valstspilsēta)$'));
end
$$;

-- Admin: add or change a feed; a new or re-enabled feed is read right away.
create or replace function meets_private.admin_save_calendar_feed(p_session_token text, p_id bigint, p_url text, p_label text,
  p_municipality_id bigint, p_default_category text, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_id bigint; v_url text := btrim(coalesce(p_url,'')); v_run boolean;
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  -- webcal:// is the same feed over https.
  v_url := regexp_replace(v_url,'^webcal://','https://','i');
  if v_url !~ '^https?://[^/\s]+\.[^/\s]+' then raise exception 'Ievadi pilnu kalendāra saiti (https://…)' using errcode='22023'; end if;
  if length(btrim(coalesce(p_label,''))) not between 2 and 120 then raise exception 'Ievadi avota nosaukumu' using errcode='22023'; end if;
  if p_id is null then
    insert into meets_private.calendar_feeds(url,label,municipality_id,default_category,active)
    values(v_url,btrim(p_label),p_municipality_id,nullif(btrim(coalesce(p_default_category,'')),''),coalesce(p_active,true))
    returning id into v_id;
    v_run := coalesce(p_active,true);
  else
    select coalesce(p_active,true) and not active into v_run from meets_private.calendar_feeds where id=p_id;
    update meets_private.calendar_feeds
       set url=v_url,label=btrim(p_label),municipality_id=p_municipality_id,
           default_category=nullif(btrim(coalesce(p_default_category,'')),''),active=coalesce(p_active,active),updated_at=now()
     where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Kalendāra saite nav atrasta' using errcode='P0002'; end if;
  end if;
  if v_run then perform meets_private.run_calendar_feeds(v_id); end if;
  return jsonb_build_object('id',v_id,'started',coalesce(v_run,false));
exception when unique_violation then
  raise exception 'Šī kalendāra saite jau ir pievienota' using errcode='23505';
end
$$;

create or replace function meets_private.admin_run_calendar_feed(p_session_token text, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  if not exists(select 1 from meets_private.calendar_feeds where id=p_id) then raise exception 'Kalendāra saite nav atrasta' using errcode='P0002'; end if;
  perform meets_private.run_calendar_feeds(p_id);
  return jsonb_build_object('started',true);
end
$$;

create or replace function public.meets_admin_calendar_feeds(p_session_token text default null)
returns jsonb language sql stable security definer set search_path to ''
as $$ select meets_private.admin_calendar_feeds(p_session_token) $$;
create or replace function public.meets_admin_save_calendar_feed(p_session_token text default null, p_id bigint default null, p_url text default null,
  p_label text default null, p_municipality_id bigint default null, p_default_category text default null, p_active boolean default true)
returns jsonb language sql security definer set search_path to ''
as $$ select meets_private.admin_save_calendar_feed(p_session_token,p_id,p_url,p_label,p_municipality_id,p_default_category,p_active) $$;
create or replace function public.meets_admin_run_calendar_feed(p_session_token text default null, p_id bigint default null)
returns jsonb language sql security definer set search_path to ''
as $$ select meets_private.admin_run_calendar_feed(p_session_token,p_id) $$;
revoke execute on function public.meets_admin_calendar_feeds(text) from public,anon;
revoke execute on function public.meets_admin_save_calendar_feed(text,bigint,text,text,bigint,text,boolean) from public,anon;
revoke execute on function public.meets_admin_run_calendar_feed(text,bigint) from public,anon;
grant execute on function public.meets_admin_calendar_feeds(text) to authenticated;
grant execute on function public.meets_admin_save_calendar_feed(text,bigint,text,text,bigint,text,boolean) to authenticated;
grant execute on function public.meets_admin_run_calendar_feed(text,bigint) to authenticated;

create or replace function meets_private.import_problems()
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  with runs as (
    select case
             when source_key like 'athletics-lv-%' then 'Vieglatlētika'
             when source_key like 'lff%' then 'Futbols (LFF)'
             when source_key like 'estlatbl-%' then 'Latvijas–Igaunijas basketbola līga'
             when source_key like 'lbs-sportradar-%' then 'Basketbols (LBS)'
             when source_key like 'handball-%' then 'Handbols'
             when source_key like 'sigulda-%' then 'Siguldas novads'
           end family,*
      from public.import_runs
  ), families as (
    select f.family,
           max(r.completed_at) filter (where r.status in ('complete','completed')) last_success,
           (array_agg(r.status order by r.imported_at desc))[1] last_status,
           (array_agg(r.error_text order by r.imported_at desc))[1] last_error,
           max(r.imported_at) last_attempt
      from (values ('Vieglatlētika'),('Futbols (LFF)'),('Latvijas–Igaunijas basketbola līga'),('Basketbols (LBS)'),('Handbols'),('Siguldas novads')) f(family)
      left join runs r on r.family=f.family
     group by f.family
  )
  select coalesce(array_agg(line order by line),'{}') from (
    select family||': '||case
             when last_status='failed' and last_attempt>now()-interval '1 day'
               then 'ielāde neizdevās'||coalesce(' — '||left(last_error,160),'')
             else 'nav veiksmīgas ielādes kopš '||coalesce(to_char(last_success at time zone 'Europe/Riga','DD.MM.'),'sākuma')
           end line
      from families
     where (last_status='failed' and last_attempt>now()-interval '1 day')
        or last_success is null or last_success<now()-interval '8 days'
    union all
    select coalesce(r.display_name,s.domain)||': '||coalesce(sr.detail,'ielāde neizdevās')||' — rāda iepriekšējo kopiju'
      from meets_private.municipality_sync_source_runs sr
      join public.sources s on s.id=sr.source_id
      left join meets_private.source_registry r on r.source_id=sr.source_id
     where sr.state='fallback' and sr.finished_at>now()-interval '1 day'
    union all
    select 'Kalendāra saite “'||f.label||'”: '||coalesce(f.last_error,'ielāde neizdevās')
      from meets_private.calendar_feeds f
     where f.active and f.last_status='failed' and f.last_run_at>now()-interval '1 day'
  ) lines
$$;

select cron.schedule('sync-calendar-feeds','35 3 * * *',$cron$select meets_private.run_calendar_feeds(null)$cron$);
