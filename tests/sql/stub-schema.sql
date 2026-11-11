-- A minimal copy of the production objects the automatic map points build on, so
-- the matching rules can be tested in an empty Postgres with PostGIS:
--   psql -d scratch -f tests/sql/stub-schema.sql
--   psql -d scratch -f supabase/migrations/20261111084937_location_auto_reference.sql
--   psql -d scratch -f supabase/migrations/20261111100352_location_auto_register_match_speed.sql
--   psql -d scratch -f supabase/migrations/20261111101048_location_auto_batched_check_and_snapshot.sql
--   psql -d scratch -f supabase/migrations/20261111101513_location_auto_register_match_stricter.sql
--   psql -d scratch -f supabase/migrations/20261111101815_location_auto_register_match_town_outside_street.sql
--   psql -d scratch -f supabase/migrations/20261111161924_location_auto_apply.sql
--   psql -d scratch -f tests/sql/location-auto.test.sql
-- The name functions further down are copied from the migrations that define them.
create extension if not exists postgis;
create schema if not exists extensions;
create schema if not exists meets_private;
create schema if not exists cron;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
-- Supabase keeps PostGIS in "extensions"; these stand in for it here.
create domain extensions.geography as public.geography;
create domain extensions.geometry as public.geometry;
create function extensions.st_setsrid(public.geometry,integer) returns public.geometry language sql immutable as 'select public.st_setsrid($1,$2)';
create function extensions.st_makepoint(double precision,double precision) returns public.geometry language sql immutable as 'select public.st_makepoint($1,$2)';
create function extensions.st_geomfromtext(text,integer) returns public.geometry language sql immutable as 'select public.st_geomfromtext($1,$2)';
create function extensions.st_multi(public.geometry) returns public.geometry language sql immutable as 'select public.st_multi($1)';
create function extensions.st_covers(public.geometry,public.geometry) returns boolean language sql immutable as 'select public.st_covers($1,$2)';
create function extensions.st_distance(public.geography,public.geography) returns double precision language sql immutable as 'select public.st_distance($1,$2)';
create function extensions.st_x(public.geometry) returns double precision language sql immutable as 'select public.st_x($1)';
create function extensions.st_y(public.geometry) returns double precision language sql immutable as 'select public.st_y($1)';
create table cron.job(jobname text primary key,schedule text,command text,active boolean default true);
create function cron.schedule(text,text,text) returns bigint language sql as
  'insert into cron.job(jobname,schedule,command) values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning 1::bigint';

create table public.municipalities(id bigint primary key,name text not null);
create table public.events(
  id uuid primary key default gen_random_uuid(),title text,status text not null default 'pending_review',
  review_status text,import_key text,date_from date,date_to date,attendance_mode text,
  updated_at timestamptz default now(),last_change_summary text);
create table public.sources(id bigint primary key,domain text,map_visible boolean);
create table public.event_sources(id bigint generated always as identity primary key,
  event_id uuid references public.events(id) on delete cascade,source_id bigint,source_url text);
create table public.event_locations(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  venue_name text,address_raw text,address_normalized text,alternative_address text,locality_text text,
  municipality_id bigint references public.municipalities(id),country_code text,
  venue_point public.geography,fallback_point public.geography,
  map_point public.geography generated always as (coalesce(venue_point,fallback_point)) stored,
  location_precision text,location_quality text,location_basis text,location_source text,location_note text,
  location_review_reason text,verified_at timestamptz,
  geocode_query text,geocode_candidates jsonb default '[]'::jsonb,geocode_suggested_at timestamptz,
  check (not (venue_point is not null and fallback_point is not null)));
create table meets_private.app_settings(key text primary key,value text);
create table meets_private.address_register(kods bigint primary key,std text not null,house_key text not null,places text not null,
  latitude double precision not null,longitude double precision not null,updated_at timestamptz not null default now());
create index on meets_private.address_register(house_key);
create table meets_private.place_search_queue(venue_name text primary key,municipality_id bigint,query text not null,
  event_count integer not null default 0,state text not null default 'queued',attempts integer not null default 0,
  known_checked_at timestamptz,finished_at timestamptz,candidates jsonb,address_text text);
create function meets_private.admin_session_valid(text) returns boolean language sql as 'select false';

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

create or replace function meets_private.place_names_match(p_name text, p_candidate text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  with candidate as (
    select ' '||meets_private.plain_text(meets_private.place_search_query(p_candidate,null))||' ' t
  )
  select coalesce(bool_and(case
           when w ~ '^[0-9]+$' then position(' '||w||' ' in (select t from candidate))>0
           else position(left(w,greatest(4,length(w)-2)) in (select t from candidate))>0 end),false)
    from regexp_split_to_table(meets_private.plain_text(meets_private.place_search_query(p_name,null)),' ') w
   where w ~ '^[0-9]+$' or length(w)>3
$$;

create or replace function meets_private.address_key(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    ' '||meets_private.plain_text(p_text)||' ',
    ' bulvari ',' bulvaris ','g'),' prospekta ',' prospekts ','g'),' laukuma ',' laukums ','g'),
    ' cela ',' cels ','g'),' dambi ',' dambis ','g'),
    '([0-9]) ([a-z])( |$)','\1\2\3','g'))
$$;

create or replace function meets_private.location_base_hall_name(p_name text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select trim(regexp_replace(regexp_replace(coalesce(p_name,''),
    '[,(;[:space:]-]*\(?[[:space:]]*([0-9]+[[:space:]]*\.?[[:space:]]*(laukums|lauk\.?|zāle|zale|z\.|korts|court)|(laukums|zāle|zale|korts)[[:space:]]*[0-9]+|maz[aā] z[aā]le|liel[aā] z[aā]le)[[:space:]]*\)?[[:space:]]*$','','i'),
    '[,(;[:space:]-]*\(?[[:space:]]*([0-9]+[[:space:]]*\.?[[:space:]]*(laukums|lauk\.?|zāle|zale|z\.|korts|court)|(laukums|zāle|zale|korts)[[:space:]]*[0-9]+|maz[aā] z[aā]le|liel[aā] z[aā]le)[[:space:]]*\)?[[:space:]]*$','','i'))
$function$;

-- As in production (meets_private.classify_event_location).
create or replace function meets_private.classify_event_location()
returns trigger language plpgsql set search_path to '' as $$
begin
  if new.location_precision='venue' and new.venue_point is not null and new.verified_at is not null then
    new.location_quality := 'verified_exact'; new.location_review_reason := null;
  elsif new.location_precision='venue' and new.venue_point is not null
     and coalesce(new.location_source,'') like 'https://www.openstreetmap.org/%' and coalesce(new.address_raw,'') ~ '[0-9]' then
    new.location_quality := 'source_exact';
  elsif new.location_precision='venue' and new.venue_point is not null then
    new.location_quality := 'venue_unverified';
  elsif new.venue_point is not null then
    new.location_quality := 'venue_area';
  elsif new.fallback_point is not null then
    new.location_quality := 'fallback_center';
  else
    new.location_quality := 'missing_point';
    new.location_review_reason := 'Nav noteiktas izmantojamas kartes koordinātas.';
  end if;
  return new;
end $$;
create trigger classify_event_location_before_write before insert or update on public.event_locations
  for each row execute function meets_private.classify_event_location();
