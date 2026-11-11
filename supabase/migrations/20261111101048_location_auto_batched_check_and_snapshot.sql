-- 1. The institutions' coordinate check took longer than one API call may (8 s):
--    it now checks 300 institutions per call and the loader calls it until none wait.
-- 2. The plan takes several seconds, too long for the step 4 loader to compute on
--    every call. meets_private.location_auto_plan_snapshot keeps the last plan; it
--    is also the list of places left to the admin, with the reason for each.

alter table meets_private.culture_institutions add column if not exists coord_checked_at timestamptz;

create or replace function meets_private.culture_institutions_check_batch(p_limit integer default 300)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  update meets_private.culture_institutions i
     set coord_check=c.result,coord_checked_at=now()
    from (
      select i2.isil,
             case
               when i2.municipality_id is null or not meets_private.point_in_country('LV',i2.latitude,i2.longitude) then null
               when reg.j->>'status'='match' then
                 case when meets_private.points_distance_m(i2.latitude,i2.longitude,(reg.j->>'latitude')::float8,(reg.j->>'longitude')::float8)<=300
                      then 'register' end
               when reg.j->>'status'='none' and exists (
                 select 1 from meets_private.place_centroids pc
                  where pc.municipality_id=i2.municipality_id and pc.kind in ('city','village')
                    and pc.name_stem=any(meets_private.std_locality_stems(i2.address))
                    and meets_private.points_distance_m(i2.latitude,i2.longitude,pc.latitude,pc.longitude)
                        <=case when pc.kind='city' then 12000 else 4000 end) then 'settlement'
             end result
        from (select * from meets_private.culture_institutions
               where coord_checked_at is null order by isil limit greatest(1,coalesce(p_limit,300))) i2
        cross join lateral (select meets_private.location_auto_register_match(i2.address,i2.municipality_id) j) reg
    ) c
   where c.isil=i.isil;
  -- How many still wait.
  select count(*) into v_count from meets_private.culture_institutions where coord_checked_at is null;
  return v_count;
end
$$;

create or replace function public.meets_place_reference_import(p_kind text, p_rows jsonb, p_first boolean default false, p_last boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer := 0; v_started timestamptz;
begin
  if p_kind not in ('centroids','institutions') then raise exception 'Unknown kind %',p_kind; end if;
  if p_first then
    update meets_private.place_reference_load
       set state='running',rows_loaded=0,started_at=now(),finished_at=null,error=null where kind=p_kind;
  end if;

  if p_kind='centroids' then
    -- [kods, type code, name, std, latitude, longitude]; 104 town, 105 parish, 106 village.
    insert into meets_private.place_centroids(kods,kind,name,name_stem,std,municipality_id,latitude,longitude)
    select (r->>0)::bigint,
           case r->>1 when '104' then 'city' when '105' then 'parish' else 'village' end,
           r->>2,
           meets_private.lv_stems(regexp_replace(r->>2,'\s+pag\.$','')),
           r->>3,meets_private.std_municipality_id(r->>3),(r->>4)::float8,(r->>5)::float8
      from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) r
     where r->>1 in ('104','105','106')
    on conflict(kods) do update
       set kind=excluded.kind,name=excluded.name,name_stem=excluded.name_stem,std=excluded.std,
           municipality_id=excluded.municipality_id,latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now();
  else
    -- [isil, sector, kind, name, address, latitude, longitude, url]
    insert into meets_private.culture_institutions(isil,sector,kind,name,address,municipality_id,latitude,longitude,url)
    select r->>0,r->>1,nullif(r->>2,''),btrim(r->>3),r->>4,meets_private.std_municipality_id(r->>4),
           (r->>5)::float8,(r->>6)::float8,nullif(r->>7,'')
      from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) r
    on conflict(isil) do update
       set sector=excluded.sector,kind=excluded.kind,name=excluded.name,address=excluded.address,
           municipality_id=excluded.municipality_id,latitude=excluded.latitude,longitude=excluded.longitude,
           url=excluded.url,coord_check=null,coord_checked_at=null,updated_at=now();
  end if;
  get diagnostics v_count=row_count;
  update meets_private.place_reference_load set rows_loaded=rows_loaded+v_count where kind=p_kind
  returning started_at into v_started;

  if p_last then
    -- Rows the new file no longer has are dropped, unless the file came back almost empty.
    if p_kind='centroids' then
      if (select count(*) from meets_private.place_centroids where updated_at>=v_started)>=3000 then
        delete from meets_private.place_centroids where updated_at<v_started;
      end if;
    else
      if (select count(*) from meets_private.culture_institutions where updated_at>=v_started)>=1000 then
        delete from meets_private.culture_institutions i where i.updated_at<v_started
           and not exists (select 1 from meets_private.location_auto_places p where p.source_ref='kulturasdati:'||i.isil);
      end if;
    end if;
    update meets_private.place_reference_load set state='done',finished_at=now() where kind=p_kind;
  end if;
  return jsonb_build_object('loaded',v_count);
end
$$;

-- The whole table at once, for use from SQL (no API time limit there).
create or replace function meets_private.culture_institutions_check()
returns integer
language sql
security definer
set search_path to ''
as $$
  select meets_private.culture_institutions_check_batch(1000000)
$$;

-- Checks the next institutions; returns how many still wait (edge function load-place-reference).
create or replace function public.meets_place_reference_check(p_limit integer default 300)
returns integer
language sql
security definer
set search_path to ''
as $$
  select meets_private.culture_institutions_check_batch(p_limit)
$$;

create table if not exists meets_private.location_auto_plan_snapshot(
  place_key text, municipality_id bigint, municipality text, sample_name text, sample_address text,
  events integer, published integer, upcoming integer,
  decision text, method text, source_ref text, matched_label text, matched_address text,
  latitude double precision, longitude double precision, reason text, event_ids uuid[],
  refreshed_at timestamptz not null default now()
);
revoke all on meets_private.location_auto_plan_snapshot from public,anon,authenticated;

-- Stores the current plan; returns the number of places in it.
create or replace function meets_private.location_auto_plan_refresh(p_steps text[] default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  delete from meets_private.location_auto_plan_snapshot where true;
  insert into meets_private.location_auto_plan_snapshot(place_key,municipality_id,municipality,sample_name,sample_address,
    events,published,upcoming,decision,method,source_ref,matched_label,matched_address,latitude,longitude,reason,event_ids)
  select p.place_key,p.municipality_id,p.municipality,p.sample_name,p.sample_address,
         p.events,p.published,p.upcoming,p.decision,p.method,p.source_ref,p.matched_label,p.matched_address,
         p.latitude,p.longitude,p.reason,p.event_ids
    from meets_private.location_auto_plan(p_steps) p;
  get diagnostics v_count=row_count;
  return v_count;
end
$$;

-- The next source pages to read: places the first three steps could not resolve,
-- from the stored plan.
create or replace function public.meets_location_source_pages_next(p_limit integer default 10, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not p_force and coalesce((select value from meets_private.app_settings where key='location_auto_source_pages'),'off')<>'on' then
    return '[]'::jsonb;
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('event_id',x.event_id,'url',x.source_url)),'[]'::jsonb) from (
      select distinct on (e.event_id) e.event_id,es.source_url
        from meets_private.location_auto_plan_snapshot p
        cross join unnest(p.event_ids) e(event_id)
        join public.event_sources es on es.event_id=e.event_id and es.source_url ~ '^https?://'
       where p.decision='manual' and p.municipality_id is not null
         and p.reason in ('Adrese nav atrasta adrešu reģistrā šajā novadā','Nosaukums nav atrasts ne iestāžu tabulā, ne apdzīvoto vietu sarakstā')
         and not exists (select 1 from meets_private.location_source_addresses s
                          where s.event_id=e.event_id and s.fetched_at>now()-interval '30 days')
       order by e.event_id,es.id
       limit greatest(1,least(coalesce(p_limit,10),50))
    ) x);
end
$$;

revoke execute on function meets_private.culture_institutions_check_batch(integer) from public,anon,authenticated;
revoke execute on function meets_private.culture_institutions_check() from public,anon,authenticated;
revoke execute on function meets_private.location_auto_plan_refresh(text[]) from public,anon,authenticated;
revoke execute on function public.meets_place_reference_import(text,jsonb,boolean,boolean) from public,anon,authenticated;
revoke execute on function public.meets_place_reference_check(integer) from public,anon,authenticated;
revoke execute on function public.meets_location_source_pages_next(integer,boolean) from public,anon,authenticated;
grant execute on function public.meets_place_reference_import(text,jsonb,boolean,boolean) to service_role;
grant execute on function public.meets_place_reference_check(integer) to service_role;
grant execute on function public.meets_location_source_pages_next(integer,boolean) to service_role;
