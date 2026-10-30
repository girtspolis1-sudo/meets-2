-- Address suggestions for places without a verified map point are looked up in
-- the background: known MEETS places first, then one OpenStreetMap search every
-- 10 seconds, the places with the most events first. Nothing is verified here;
-- the admin still approves each suggestion in Admin → Mapping.

-- Lower-case text without Latvian diacritics or punctuation, for comparing names.
create or replace function meets_private.plain_text(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_text,'')),'āčēģīķļņōŗšūžõäöüė','acegiklnorsuzoaoue'),
    '[^a-z0-9]+',' ','g'))
$$;

-- "Rīgas Teikas vsk. 1.zale" -> "Rīgas Teikas vidusskola";
-- "Cēsu SK" + Cēsu novads -> "Cēsu sporta komplekss".
create or replace function meets_private.place_search_query(p_place text, p_municipality text)
returns text
language plpgsql
immutable
set search_path to ''
as $$
declare
  q text := coalesce(p_place,'');
  area text := btrim(coalesce(p_municipality,''));
begin
  q := regexp_replace(q,'\(([^)]*)\)',', \1','g');
  q := regexp_replace(q,'[,\s]*\mLV-?\d{4}\M','','gi');
  q := regexp_replace(q,'\m\d+\.?\s*z[aā]le\M','','gi');
  -- Abbreviations used by league and municipality calendars.
  q := regexp_replace(q,'(^|[\s,.0-9])vsk\.?(?=[\s,]|$)','\1vidusskola','gi');
  q := regexp_replace(q,'(^|[\s,.0-9])psk\.?(?=[\s,]|$)','\1pamatskola','gi');
  q := regexp_replace(q,'(^|[\s,.0-9])ģimn\.?(?=[\s,]|$)','\1ģimnāzija','gi');
  q := regexp_replace(q,'(^|[\s,])SH(?=[\s,]|$)','\1sporta halle','g');
  q := regexp_replace(q,'(^|[\s,])SN(?=[\s,]|$)','\1sporta nams','g');
  q := regexp_replace(q,'(^|[\s,])SK(?=[\s,]|$)','\1sporta komplekss','g');
  q := regexp_replace(q,'(^|[\s,])SC(?=[\s,]|$)','\1sporta centrs','g');
  q := regexp_replace(q,'(^|[\s,])OC(?=[\s,]|$)','\1olimpiskais centrs','g');
  q := regexp_replace(q,'(^|[\s,])NSS(?=[\s,]|$)','\1novada sporta skola','g');
  q := regexp_replace(q,'(^|[\s,])SS(?=[\s,]|$)','\1sporta skola','g');
  q := regexp_replace(q,'(^|[\s,])KN(?=[\s,]|$)','\1kultūras nams','g');
  q := regexp_replace(q,'(^|[\s,])KC(?=[\s,]|$)','\1kultūras centrs','g');
  q := regexp_replace(q,'(^|[\s,])TN(?=[\s,]|$)','\1tautas nams','g');
  q := btrim(regexp_replace(regexp_replace(q,'\s*,[\s,]*',', ','g'),'\s+',' ','g'),' ,');

  -- Add the municipality unless the name already says where it is.
  if area<>'' and area !~* '^(ārpus|vairākas)' then
    if area ~ ' valstspilsēta$' then
      -- "Rīgas valstspilsēta" -> "Rīga", "Rēzeknes valstspilsēta" -> "Rēzekne"
      area := regexp_replace(regexp_replace(area,' valstspilsēta$',''),'([ae])s$','\1');
    end if;
    if position(left(meets_private.plain_text(area),4) in meets_private.plain_text(q))=0 then
      q := q||', '||area;
    end if;
  end if;
  return q;
end
$$;

-- The municipality named by a place such as "Talsu SN", "Saldus" or "Rīgas Teikas vsk.":
-- the first word as a municipality name, otherwise as a town MEETS already knows.
-- Street names ("Rīgas iela 5") say nothing about the municipality.
create or replace function meets_private.guess_municipality_id(p_place text, p_locality text)
returns bigint
language plpgsql
stable
set search_path to ''
as $$
declare
  v_text text;
  v_word text;
  v_ids bigint[];
begin
  foreach v_text in array array[meets_private.plain_text(p_place),meets_private.plain_text(p_locality)] loop
    v_word := split_part(v_text,' ',1);
    continue when length(v_word)<3
      or split_part(v_text,' ',2) in ('iela','gatve','soseja','prospekts','bulvaris','laukums','krastmala');
    select array_agg(distinct m.id) into v_ids
      from public.municipalities m
     where m.name ~ ' (novads|valstspilsēta)$'
       and split_part(meets_private.plain_text(m.name),' ',1)=v_word;
    if cardinality(v_ids)=1 then return v_ids[1]; end if;
    select array_agg(x.municipality_id) into v_ids from (
      select l.municipality_id
        from public.settlements s
        join public.event_locations l on l.settlement_id=s.id and l.municipality_id is not null
       where meets_private.plain_text(s.name)=v_word
       group by l.municipality_id
       order by count(*) desc
       limit 1
    ) x;
    if cardinality(v_ids)=1 then return v_ids[1]; end if;
  end loop;
  return null;
end
$$;

create or replace function meets_private.assign_municipality_from_place_name()
returns trigger
language plpgsql
set search_path to ''
as $$
declare v_id bigint;
begin
  if new.municipality_id is null and coalesce(new.country_code,'LV')='LV' then
    v_id := meets_private.guess_municipality_id(coalesce(nullif(btrim(new.venue_name),''),new.address_raw),new.locality_text);
    if v_id is not null then
      new.municipality_id := v_id;
      new.municipality_basis := 'Noteikts pēc vietas nosaukuma';
    end if;
  end if;
  return new;
end
$$;

-- Runs after assign_known_lv_municipality_before_write (triggers fire in name order).
drop trigger if exists assign_municipality_from_place_name_before_write on public.event_locations;
create trigger assign_municipality_from_place_name_before_write
  before insert or update of venue_name,address_raw,locality_text,municipality_id,country_code
  on public.event_locations
  for each row execute function meets_private.assign_municipality_from_place_name();

-- Known MEETS places for one name; shared by the admin lookup and the background search.
create or replace function meets_private.match_known_places(p_name text, p_municipality text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_name text := lower(btrim(coalesce(p_name,'')));
  v_area text;
  v_matches jsonb;
begin
  if length(v_name)<3 then return '[]'::jsonb; end if;
  perform set_config('pg_trgm.similarity_threshold','0.4',true);
  -- "Rīgas valstspilsēta" -> "rīga", "Ādažu novads" -> "ādaž": a match in that area ranks first.
  v_area := nullif(left(lower(btrim(regexp_replace(coalesce(p_municipality,''),'\s*(valstspilsēta|novads|pilsēta)\s*$','','i'))),5),'');
  select coalesce(jsonb_agg(m order by (m->>'score')::numeric desc),'[]'::jsonb) into v_matches from (
    select jsonb_build_object('label',c.label,'displayName',c.address,'latitude',c.lat,'longitude',c.lon,
      'source',c.source,'type','meets_known','category','meets','score',round(c.score::numeric,2),'sameArea',c.same_area) m
    from (
      select *,v_area is not null and lower(label||' '||address) like '%'||v_area||'%' as same_area,
             base_score+case when v_area is not null and lower(label||' '||address) like '%'||v_area||'%' then 0.2
                             when v_area is not null then -0.1 else 0 end as score
      from (
        select distinct on (round(lat::numeric,4),round(lon::numeric,4)) * from (
          select a.canonical_venue_name label,coalesce(a.canonical_address_text,a.canonical_venue_name) address,
                 a.latitude lat,a.longitude lon,'Saglabāts mapping' source,
                 extensions.similarity(lower(a.alias_text),v_name)+0.05 base_score
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
        order by round(lat::numeric,4),round(lon::numeric,4),base_score desc
      ) d
    ) c
    order by c.score desc limit 3
  ) best;
  return v_matches;
end
$$;

create or replace function public.meets_admin_match_places(p_session_token text, p_places jsonb)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare v_place jsonb; v_out jsonb:='[]'::jsonb; v_matches jsonb;
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  if jsonb_typeof(p_places)<>'array' or jsonb_array_length(p_places)>60 then raise exception 'Ne vairāk kā 60 vietas vienā pieprasījumā'; end if;
  for v_place in select value from jsonb_array_elements(p_places) loop
    v_matches := meets_private.match_known_places(v_place->>'name',v_place->>'municipality');
    if jsonb_array_length(v_matches)>0 then
      v_out := v_out||jsonb_build_array(jsonb_build_object('key',v_place->'key','matches',v_matches));
    end if;
  end loop;
  return v_out;
end
$$;

-- OpenStreetMap results in the shape the admin suggestions use, best first.
-- Scored like /api/admin/geocode: name words, the municipality, sports venues, importance.
create or replace function meets_private.place_search_candidates(p_results jsonb, p_query text, p_municipality text)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  with tokens as (
    select coalesce(array_agg(t),'{}') t
      from regexp_split_to_table(meets_private.plain_text(p_query),' ') t
     where length(t)>2
  ), area as (
    select nullif(left(meets_private.plain_text(regexp_replace(coalesce(p_municipality,''),' (valstspilsēta|novads)$','')),4),'') stem
  ), items as (
    select distinct on (x->>'osm_type',x->>'osm_id') x,(x->>'lat')::float8 lat,(x->>'lon')::float8 lon
      from jsonb_array_elements(case when jsonb_typeof(p_results)='array' then p_results else '[]'::jsonb end) x
     where (x->>'lat') ~ '^-?[0-9]+(\.[0-9]+)?$' and (x->>'lon') ~ '^-?[0-9]+(\.[0-9]+)?$'
  ), scored as (
    select i.*,
      2*(select count(*) from unnest((select t from tokens)) tok
          where position(tok in meets_private.plain_text(coalesce(i.x->>'name','')||' '||coalesce(i.x->>'display_name','')))>0)
      + case when (select stem from area) is not null
              and position((select stem from area) in meets_private.plain_text(i.x->>'display_name'))>0 then 2 else 0 end
      + case when i.x->>'type' in ('stadium','sports_centre','pitch','sports_hall') then 4 else 0 end
      + least(3,coalesce(case when (i.x->>'importance') ~ '^[0-9.]+$' then (i.x->>'importance')::numeric end,0)*3) score
    from items i
    where i.lat between 53.5 and 60.8 and i.lon between 16 and 31.5
  )
  select coalesce(jsonb_agg(c order by (c->>'score')::numeric desc),'[]'::jsonb) from (
    select jsonb_build_object(
      'id',(x->>'osm_type')||':'||(x->>'osm_id'),
      'label',coalesce(nullif(x->>'name',''),nullif(split_part(x->>'display_name',',',1),''),'Vieta'),
      'displayName',coalesce(x->>'display_name',''),
      'latitude',lat,'longitude',lon,
      'type',x->>'type','category',x->>'category',
      'sourceUrl',case when x->>'osm_type' in ('node','way','relation') and x->>'osm_id' ~ '^[0-9]+$'
                       then 'https://www.openstreetmap.org/'||(x->>'osm_type')||'/'||(x->>'osm_id') end,
      'source','OpenStreetMap',
      'score',round(score,2)) c
    from scored
    order by score desc
    limit 5
  ) best
$$;

create table if not exists meets_private.place_search_queue(
  venue_name text primary key,
  municipality_id bigint,
  query text not null,
  event_count integer not null default 0,
  state text not null default 'queued' check (state in ('queued','requested','done','failed')),
  attempts integer not null default 0,
  known_checked_at timestamptz,
  request_id bigint,
  requested_at timestamptz,
  finished_at timestamptz,
  result_count integer,
  candidates jsonb,
  source text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists place_search_queue_next on meets_private.place_search_queue(state,event_count desc);
revoke all on meets_private.place_search_queue from public,anon,authenticated;

-- Stores suggestions for every unverified event at the place.
create or replace function meets_private.place_search_store(p_venue_name text, p_query text, p_candidates jsonb, p_source text)
returns void
language sql
security definer
set search_path to ''
as $$
  update meets_private.place_search_queue
     set state='done',finished_at=now(),candidates=p_candidates,result_count=jsonb_array_length(p_candidates),
         source=p_source,error=null
   where venue_name=p_venue_name;
  update public.event_locations l
     set geocode_query=left(p_query,300),geocode_candidates=p_candidates,geocode_suggested_at=now()
   where l.venue_name=p_venue_name and l.verified_at is null;
$$;

-- Adds the places of upcoming events that still lack a verified point.
create or replace function meets_private.place_search_enqueue()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  with places as (
    select l.venue_name,mode() within group (order by l.municipality_id) municipality_id,count(*) n
      from public.events e
      join public.event_locations l on l.event_id=e.id
     where e.status in ('pending_review','published')
       and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date
       and coalesce(e.attendance_mode,'')<>'online'
       and l.verified_at is null
       and coalesce(l.location_quality,'')<>'verified_exact'
       and length(btrim(coalesce(l.venue_name,'')))>=3
     group by l.venue_name
  )
  insert into meets_private.place_search_queue as q(venue_name,municipality_id,query,event_count)
  select p.venue_name,p.municipality_id,meets_private.place_search_query(p.venue_name,m.name),p.n
    from places p left join public.municipalities m on m.id=p.municipality_id
  on conflict(venue_name) do update
     set event_count=excluded.event_count,
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
   where q.state='done' and l.venue_name=q.venue_name and l.verified_at is null and l.geocode_suggested_at is null;
  return v_count;
end
$$;

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
     where (x->>'score')::numeric>=0.75 and coalesce((x->>'sameArea')::boolean,true);
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

create or replace function meets_private.admin_place_search_status(p_session_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  return (
    select jsonb_build_object(
      'waiting',count(*) filter (where state in ('queued','requested')),
      'waitingEvents',coalesce(sum(event_count) filter (where state in ('queued','requested')),0),
      'found',count(*) filter (where state='done' and result_count>0),
      'notFound',count(*) filter (where state='done' and coalesce(result_count,0)=0),
      'failed',count(*) filter (where state='failed'),
      'lastFinishedAt',max(finished_at))
    from meets_private.place_search_queue q
    where exists (select 1 from public.event_locations l where l.venue_name=q.venue_name and l.verified_at is null)
  );
end
$$;

-- Searches again where nothing was found or the search failed, and adds new places.
create or replace function meets_private.admin_place_search_retry(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_retry integer;
begin
  if not meets_private.admin_session_valid(p_session_token) then raise exception 'Unauthorized' using errcode='42501'; end if;
  update meets_private.place_search_queue
     set state='queued',attempts=0,known_checked_at=null,error=null
   where state='failed' or (state='done' and coalesce(result_count,0)=0);
  get diagnostics v_retry=row_count;
  return jsonb_build_object('retried',v_retry,'queued',meets_private.place_search_enqueue());
end
$$;

create or replace function public.meets_admin_place_search_status(p_session_token text default null)
returns jsonb language sql stable security definer set search_path to ''
as $$ select meets_private.admin_place_search_status(p_session_token) $$;
create or replace function public.meets_admin_place_search_retry(p_session_token text default null)
returns jsonb language sql security definer set search_path to ''
as $$ select meets_private.admin_place_search_retry(p_session_token) $$;
revoke execute on function public.meets_admin_place_search_status(text) from public,anon;
revoke execute on function public.meets_admin_place_search_retry(text) from public,anon;
grant execute on function public.meets_admin_place_search_status(text) to authenticated;
grant execute on function public.meets_admin_place_search_retry(text) to authenticated;

-- Places of upcoming events whose name tells the municipality.
update public.event_locations l
   set municipality_id=g.municipality_id,municipality_basis='Noteikts pēc vietas nosaukuma'
  from (
    select l2.event_id,meets_private.guess_municipality_id(coalesce(nullif(btrim(l2.venue_name),''),l2.address_raw),l2.locality_text) municipality_id
      from public.event_locations l2
      join public.events e on e.id=l2.event_id
     where l2.municipality_id is null and coalesce(l2.country_code,'LV')='LV'
       and coalesce(e.date_to,e.date_from)>=(now() at time zone 'Europe/Riga')::date
  ) g
 where g.event_id=l.event_id and g.municipality_id is not null;

select meets_private.place_search_enqueue();

select cron.schedule('meets-place-search','10 seconds',$$select meets_private.place_search_tick()$$);
select cron.schedule('meets-place-search-enqueue','43 * * * *',$$select meets_private.place_search_enqueue()$$);
