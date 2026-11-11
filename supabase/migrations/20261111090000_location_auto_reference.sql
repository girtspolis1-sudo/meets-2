-- Automatic map points for places without a verified point, part 1: reference
-- data, matching rules and the plan (dry run). Nothing here changes an event.
--
-- 1. Address register: the one street address of the event text that lies in the
--    event's municipality and in the town or parish the text names.
-- 2. Known institutions: "Latvijas kultūras institūcijas" (data.gov.lv, source
--    kulturasdati.lv), matched by name within the municipality.
-- 3. A bare town, village or parish name: its official centre (VZD "Vietu centroidi").
-- 4. An address found on the event's source page, looked up in the address register.
-- Coordinates only ever come from these three tables. A point outside Latvia,
-- two different answers for one place or any doubt leaves the place to the admin.

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------
create table if not exists meets_private.country_borders(
  country_code text primary key,
  geom extensions.geometry not null,
  source text not null,
  updated_at timestamptz not null default now()
);
revoke all on meets_private.country_borders from public,anon,authenticated;

-- Latvia: the union of all municipalities and towns of the State Address Register
-- spatial data (aw_shp.zip, 11.2026), widened by 500 m and simplified to 400 m.
insert into meets_private.country_borders(country_code,geom,source)
values('LV',extensions.st_multi(extensions.st_geomfromtext('POLYGON ((20.964 56.344, 20.991 56.469, 20.98 56.508, 20.961 56.524, 20.954 56.549, 20.965 56.558, 20.993 56.561, 21.043 56.672, 21.048 56.835, 21.06 56.846, 21.161 56.895, 21.181 56.897, 21.237 56.921, 21.283 56.957, 21.343 56.985, 21.366 57.004, 21.401 57.05, 21.409 57.08, 21.398 57.175, 21.411 57.292, 21.499 57.369, 21.52 57.393, 21.52 57.411, 21.553 57.411, 21.586 57.432, 21.654 57.508, 21.681 57.559, 21.706 57.577, 21.842 57.602, 22.009 57.611, 22.5 57.747, 22.559 57.759, 22.609 57.763, 22.586 57.715, 22.582 57.682, 22.595 57.642, 22.622 57.606, 22.701 57.553, 22.817 57.515, 22.824 57.505, 22.853 57.495, 22.945 57.42, 23.015 57.398, 23.039 57.383, 23.09 57.372, 23.124 57.371, 23.14 57.362, 23.146 57.326, 23.169 57.304, 23.188 57.265, 23.186 57.236, 23.247 57.165, 23.238 57.139, 23.245 57.111, 23.273 57.087, 23.309 57.068, 23.365 57.05, 23.491 57.038, 23.532 56.997, 23.564 56.981, 23.65 56.967, 23.763 56.976, 23.925 57.011, 23.996 57.045, 24.012 57.058, 24.002 57.065, 24.009 57.072, 24.03 57.07, 24.081 57.08, 24.167 57.11, 24.335 57.2, 24.393 57.25, 24.404 57.285, 24.391 57.316, 24.391 57.398, 24.372 57.512, 24.354 57.541, 24.355 57.578, 24.378 57.616, 24.334 57.702, 24.338 57.793, 24.325 57.828, 24.342 57.879, 24.418 57.872, 24.45 57.882, 24.447 57.903, 24.437 57.908, 24.456 57.928, 24.502 57.934, 24.515 57.947, 24.582 57.966, 24.625 57.947, 24.641 57.963, 24.678 57.963, 24.692 57.954, 24.711 57.966, 24.735 57.968, 24.74 57.986, 24.809 57.995, 24.834 57.979, 24.846 57.98, 24.945 58.013, 25.014 58.021, 25.07 58.069, 25.097 58.071, 25.102 58.082, 25.181 58.08, 25.2 58.09, 25.22 58.082, 25.225 58.073, 25.216 58.066, 25.237 58.054, 25.228 58.03, 25.252 58.024, 25.254 58.017, 25.244 58.014, 25.265 57.999, 25.288 57.997, 25.295 58.033, 25.257 58.058, 25.258 58.068, 25.274 58.073, 25.282 58.085, 25.298 58.086, 25.325 58.072, 25.37 58.035, 25.411 58.033, 25.455 58.02, 25.475 58.005, 25.455 57.997, 25.489 57.98, 25.52 57.985, 25.531 57.976, 25.554 57.977, 25.561 57.972, 25.573 57.978, 25.586 57.975, 25.603 57.96, 25.594 57.946, 25.644 57.934, 25.658 57.92, 25.683 57.916, 25.687 57.909, 25.7 57.908, 25.721 57.925, 25.74 57.928, 25.795 57.907, 25.826 57.869, 25.857 57.862, 25.879 57.869, 25.895 57.855, 25.933 57.858, 25.962 57.851, 25.999 57.864, 26.016 57.862, 26.025 57.852, 26.062 57.852, 26.067 57.836, 26.035 57.776, 26.056 57.766, 26.081 57.771, 26.141 57.755, 26.149 57.737, 26.178 57.733, 26.213 57.718, 26.192 57.69, 26.218 57.683, 26.223 57.668, 26.247 57.66, 26.253 57.632, 26.283 57.601, 26.315 57.597, 26.334 57.585, 26.346 57.588, 26.403 57.577, 26.474 57.579, 26.507 57.527, 26.528 57.521, 26.555 57.519, 26.554 57.531, 26.585 57.544, 26.607 57.519, 26.607 57.531, 26.641 57.557, 26.663 57.558, 26.673 57.571, 26.697 57.575, 26.71 57.572, 26.734 57.592, 26.76 57.582, 26.831 57.587, 26.852 57.595, 26.858 57.619, 26.907 57.638, 26.93 57.637, 26.938 57.627, 26.957 57.623, 26.95 57.608, 26.975 57.617, 26.997 57.615, 27.002 57.609, 27.035 57.609, 27.052 57.598, 27.049 57.587, 27.091 57.581, 27.121 57.566, 27.163 57.565, 27.195 57.555, 27.226 57.559, 27.261 57.555, 27.285 57.543, 27.302 57.543, 27.33 57.528, 27.353 57.525, 27.374 57.54, 27.417 57.528, 27.499 57.545, 27.563 57.541, 27.559 57.525, 27.576 57.509, 27.564 57.497, 27.559 57.465, 27.546 57.462, 27.528 57.43, 27.565 57.417, 27.606 57.42, 27.629 57.406, 27.675 57.399, 27.691 57.375, 27.763 57.358, 27.787 57.345, 27.786 57.325, 27.829 57.327, 27.876 57.292, 27.869 57.266, 27.879 57.248, 27.852 57.227, 27.85 57.211, 27.837 57.202, 27.841 57.166, 27.826 57.142, 27.791 57.129, 27.763 57.127, 27.748 57.115, 27.761 57.108, 27.757 57.095, 27.728 57.096, 27.777 57.085, 27.752 57.067, 27.757 57.052, 27.737 57.037, 27.724 57.008, 27.77 57.01, 27.778 57.005, 27.75 56.956, 27.745 56.918, 27.726 56.911, 27.691 56.908, 27.664 56.852, 27.667 56.84, 27.687 56.841, 27.729 56.861, 27.817 56.871, 27.849 56.884, 27.881 56.88, 27.879 56.867, 27.909 56.827, 27.962 56.842, 27.975 56.839, 27.984 56.81, 27.952 56.8, 27.952 56.775, 27.923 56.77, 27.908 56.754, 27.921 56.753, 27.926 56.736, 27.954 56.72, 27.987 56.71, 27.985 56.694, 28.001 56.692, 28.02 56.675, 28.02 56.638, 28.047 56.61, 28.05 56.594, 28.131 56.586, 28.151 56.573, 28.15 56.551, 28.11 56.539, 28.103 56.516, 28.107 56.513, 28.127 56.52, 28.143 56.511, 28.138 56.493, 28.2 56.45, 28.191 56.425, 28.202 56.405, 28.173 56.377, 28.201 56.36, 28.214 56.324, 28.25 56.278, 28.225 56.246, 28.194 56.23, 28.212 56.214, 28.193 56.203, 28.185 56.176, 28.124 56.161, 28.102 56.147, 28.099 56.133, 28.073 56.135, 28.053 56.127, 28.048 56.115, 28.024 56.115, 28.006 56.122, 27.978 56.116, 27.976 56.108, 27.946 56.089, 27.943 56.072, 27.91 56.045, 27.875 56.048, 27.842 56.034, 27.821 56.035, 27.841 56.021, 27.819 56.003, 27.819 55.989, 27.808 55.978, 27.785 55.971, 27.758 55.974, 27.661 55.927, 27.661 55.912, 27.633 55.891, 27.648 55.848, 27.62 55.783, 27.551 55.78, 27.431 55.79, 27.362 55.808, 27.354 55.798, 27.285 55.781, 27.243 55.791, 27.194 55.83, 27.167 55.834, 27.157 55.844, 27.123 55.846, 27.11 55.841, 27.098 55.823, 27.046 55.826, 27.033 55.818, 27.017 55.823, 26.979 55.81, 26.952 55.784, 26.926 55.784, 26.908 55.749, 26.884 55.733, 26.877 55.711, 26.805 55.694, 26.788 55.674, 26.739 55.679, 26.717 55.697, 26.659 55.702, 26.642 55.679, 26.597 55.67, 26.518 55.674, 26.468 55.698, 26.438 55.705, 26.405 55.707, 26.385 55.7, 26.371 55.706, 26.346 55.738, 26.309 55.739, 26.262 55.765, 26.224 55.811, 26.222 55.836, 26.198 55.856, 26.148 55.873, 26.114 55.876, 26.048 55.933, 26.038 55.952, 26.011 55.962, 25.996 55.959, 25.97 55.977, 25.891 55.996, 25.856 55.996, 25.841 56.008, 25.851 56.021, 25.829 56.03, 25.812 56.052, 25.757 56.06, 25.733 56.073, 25.682 56.084, 25.691 56.118, 25.669 56.128, 25.675 56.143, 25.653 56.131, 25.6 56.13, 25.56 56.137, 25.536 56.161, 25.515 56.156, 25.506 56.14, 25.478 56.138, 25.436 56.15, 25.419 56.141, 25.397 56.145, 25.395 56.153, 25.339 56.15, 25.314 56.14, 25.274 56.155, 25.229 56.187, 25.203 56.172, 25.167 56.169, 25.087 56.183, 25.068 56.195, 25.047 56.263, 25.013 56.274, 25.007 56.29, 24.966 56.309, 24.962 56.363, 24.935 56.373, 24.894 56.417, 24.911 56.438, 24.881 56.445, 24.861 56.431, 24.871 56.418, 24.865 56.412, 24.823 56.406, 24.813 56.415, 24.778 56.395, 24.709 56.396, 24.712 56.386, 24.691 56.372, 24.638 56.371, 24.63 56.343, 24.584 56.32, 24.591 56.305, 24.583 56.284, 24.522 56.277, 24.454 56.254, 24.419 56.257, 24.389 56.274, 24.354 56.268, 24.338 56.291, 24.315 56.297, 24.295 56.294, 24.295 56.282, 24.206 56.263, 24.18 56.247, 24.122 56.244, 24.108 56.248, 24.11 56.26, 24.089 56.273, 24.039 56.277, 24.041 56.297, 24.016 56.309, 24.012 56.325, 23.914 56.327, 23.906 56.334, 23.806 56.338, 23.787 56.317, 23.763 56.32, 23.754 56.337, 23.772 56.362, 23.765 56.368, 23.633 56.356, 23.545 56.328, 23.435 56.348, 23.414 56.366, 23.385 56.375, 23.315 56.378, 23.285 56.368, 23.184 56.364, 23.191 56.335, 23.122 56.311, 23.119 56.304, 23.093 56.3, 23.069 56.319, 23.042 56.316, 23.02 56.329, 22.997 56.368, 23.009 56.374, 22.996 56.402, 22.974 56.402, 22.964 56.41, 22.944 56.408, 22.926 56.377, 22.903 56.37, 22.839 56.36, 22.732 56.368, 22.702 56.35, 22.68 56.347, 22.635 56.361, 22.611 56.378, 22.577 56.386, 22.509 56.388, 22.427 56.405, 22.393 56.396, 22.368 56.397, 22.348 56.389, 22.313 56.405, 22.239 56.396, 22.209 56.41, 22.205 56.419, 22.164 56.415, 22.128 56.427, 22.05 56.413, 22.022 56.42, 22.02 56.411, 22.002 56.409, 21.978 56.374, 21.955 56.376, 21.921 56.364, 21.873 56.357, 21.838 56.367, 21.792 56.34, 21.753 56.33, 21.728 56.31, 21.672 56.307, 21.657 56.313, 21.603 56.319, 21.569 56.311, 21.538 56.289, 21.499 56.287, 21.458 56.245, 21.332 56.213, 21.285 56.171, 21.237 56.158, 21.247 56.122, 21.208 56.074, 21.178 56.071, 21.161 56.081, 21.065 56.065, 20.975 56.217, 20.976 56.303, 20.964 56.344))',4326)),
       'VZD adrešu reģistra telpiskie dati (Novadi + Pilsetas), 500 m buffer')
on conflict(country_code) do update set geom=excluded.geom,source=excluded.source,updated_at=now();

create table if not exists meets_private.place_centroids(
  kods bigint primary key,
  kind text not null check (kind in ('city','village','parish')),
  name text not null,
  name_stem text not null,
  std text not null,
  municipality_id bigint references public.municipalities(id),
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);
create index if not exists place_centroids_lookup on meets_private.place_centroids(municipality_id,name_stem);
revoke all on meets_private.place_centroids from public,anon,authenticated;

create table if not exists meets_private.culture_institutions(
  isil text primary key,
  sector text not null,
  kind text,
  name text not null,
  address text not null,
  municipality_id bigint references public.municipalities(id),
  latitude double precision not null,
  longitude double precision not null,
  url text,
  -- How the coordinates were confirmed: 'register' (within 300 m of the register
  -- address), 'settlement' (near the centre of the town or village of the address).
  coord_check text check (coord_check in ('register','settlement')),
  updated_at timestamptz not null default now()
);
create index if not exists culture_institutions_municipality on meets_private.culture_institutions(municipality_id);
revoke all on meets_private.culture_institutions from public,anon,authenticated;

create table if not exists meets_private.place_reference_load(
  kind text primary key check (kind in ('centroids','institutions')),
  state text not null default 'idle' check (state in ('idle','running','done','failed')),
  rows_loaded integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
insert into meets_private.place_reference_load(kind) values('centroids'),('institutions') on conflict do nothing;
revoke all on meets_private.place_reference_load from public,anon,authenticated;

-- One automatically resolved place: every event with this name in this
-- municipality gets this point. active=false (after a revert) blocks the place
-- from being resolved automatically again.
create table if not exists meets_private.location_auto_places(
  id bigint generated always as identity primary key,
  place_key text not null,
  municipality_id bigint not null references public.municipalities(id),
  method text not null check (method in ('address_register','culture_institution','settlement_center','source_page_address')),
  source_ref text not null,
  label text,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  basis text not null,
  sample_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  revert_note text,
  unique(place_key,municipality_id)
);
revoke all on meets_private.location_auto_places from public,anon,authenticated;

-- What each event location held before the automatic point, for undoing it.
create table if not exists meets_private.location_auto_log(
  id bigint generated always as identity primary key,
  event_id uuid not null,
  place_id bigint not null references meets_private.location_auto_places(id),
  method text not null,
  previous jsonb not null,
  applied_at timestamptz not null default now(),
  reverted_at timestamptz
);
create index if not exists location_auto_log_event on meets_private.location_auto_log(event_id,place_id);
revoke all on meets_private.location_auto_log from public,anon,authenticated;

-- Addresses read from the event's source page (step 4).
create table if not exists meets_private.location_source_addresses(
  event_id uuid primary key references public.events(id) on delete cascade,
  source_url text not null,
  domain text not null,
  addresses text[] not null default '{}',
  status text not null,
  fetched_at timestamptz not null default now()
);
create index if not exists location_source_addresses_domain on meets_private.location_source_addresses(domain);
revoke all on meets_private.location_source_addresses from public,anon,authenticated;

-- Step 4 is off until switched on: update meets_private.app_settings set value='on' where key='location_auto_source_pages'.
insert into meets_private.app_settings(key,value) values('location_auto_source_pages','off') on conflict(key) do nothing;

alter table public.event_locations
  add column if not exists location_auto_place_id bigint references meets_private.location_auto_places(id);
create index if not exists event_locations_auto_place on public.event_locations(location_auto_place_id)
  where location_auto_place_id is not null;

-- ---------------------------------------------------------------------------
-- Names
-- ---------------------------------------------------------------------------
-- Words without their Latvian case endings: "Talsi", "Talsu", "Talsos" -> "tals".
create or replace function meets_private.lv_stems(p_text text)
returns text
language sql
immutable
set search_path to ''
as $$
  select coalesce(string_agg(
           case when length(w)>4 then regexp_replace(w,'(as|es|is|us|os|am|a|e|i|u|s)$','')
                when length(w)>3 then regexp_replace(w,'[aeius]$','')
                else w end,' ' order by ord),'')
    from regexp_split_to_table(meets_private.plain_text(p_text),' ') with ordinality t(w,ord)
   where w<>''
$$;

-- The same place under one key: "Rīgas Teikas vsk. 1.zāle" = "Rīgas Teikas vidusskola".
create or replace function meets_private.location_place_key(p_name text)
returns text
language sql
immutable
set search_path to ''
as $$
  select meets_private.plain_text(meets_private.place_search_query(meets_private.location_base_hall_name(p_name),null))
$$;

-- The municipality an official address lies in:
-- "…, Asūne, Asūnes pag., Krāslavas nov., LV-5677" -> Krāslavas novads; "…, Rīga, LV-1050" -> Rīgas valstspilsēta.
create or replace function meets_private.std_municipality_id(p_std text)
returns bigint
language sql
stable
set search_path to ''
as $$
  with parts as (
    select btrim(x) p,ord
      from unnest(string_to_array(regexp_replace(coalesce(p_std,''),',?\s*LV-\d{4}\s*$',''),',')) with ordinality t(x,ord)
     where btrim(x)<>''
  )
  select m.id from public.municipalities m
   where m.name=coalesce(
           (select regexp_replace(p,'\s+nov\.$',' novads') from parts where p ~ '\snov\.$' order by ord desc limit 1),
           (select case when p ~ 's$' then p else p||'s' end||' valstspilsēta' from parts order by ord desc limit 1))
$$;

-- Stems of the town or village and of the parish of an official address.
create or replace function meets_private.std_locality_stems(p_std text)
returns text[]
language sql
immutable
set search_path to ''
as $$
  with parts as (
    select btrim(x) p,ord
      from unnest(string_to_array(regexp_replace(coalesce(p_std,''),',?\s*LV-\d{4}\s*$',''),',')) with ordinality t(x,ord)
     where btrim(x)<>''
  )
  select coalesce(array_agg(s) filter (where s<>''),'{}') from (
    -- A town or village: not the street or house (first part), not a parish or municipality.
    select meets_private.lv_stems(p) s from parts
     where p !~ '\s(pag|nov)\.$' and (ord>1 or (select count(*) from parts)=1) and p !~ '[0-9"]'
    union
    select meets_private.lv_stems(regexp_replace(p,'\s+pag\.$','')) from parts where p ~ '\spag\.$'
  ) x
$$;

create or replace function meets_private.point_in_country(p_country text, p_latitude double precision, p_longitude double precision)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((
    select extensions.st_covers(b.geom,extensions.st_setsrid(extensions.st_makepoint(p_longitude,p_latitude),4326))
      from meets_private.country_borders b where b.country_code=p_country),false)
$$;

create or replace function meets_private.points_distance_m(p_lat1 double precision, p_lon1 double precision, p_lat2 double precision, p_lon2 double precision)
returns double precision
language sql
immutable
set search_path to ''
as $$
  select extensions.st_distance(
    extensions.st_setsrid(extensions.st_makepoint(p_lon1,p_lat1),4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(p_lon2,p_lat2),4326)::extensions.geography)
$$;

-- ---------------------------------------------------------------------------
-- Step 1: the address register, strictly
-- ---------------------------------------------------------------------------
-- status 'match': one register address in the municipality whose town, village or
--   parish the text names (in a city municipality the city itself is enough);
-- 'unconfirmed': the only such address in the municipality, but the text does not
--   name its town; 'ambiguous': several; 'none': no street address found.
create or replace function meets_private.location_auto_register_match(p_text text, p_municipality_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_segment text;
  v_match text;
  v_words text[];
  v_city boolean;
  v_stems text := ' '||meets_private.lv_stems(p_text)||' ';
  v_found jsonb;
  v_hits jsonb := '[]'::jsonb;
  v_total integer;
  v_confirmed integer;
begin
  if p_municipality_id is null or btrim(coalesce(p_text,''))='' then return jsonb_build_object('status','none'); end if;
  select m.name ~ ' valstspilsēta$' into v_city from public.municipalities m where m.id=p_municipality_id;
  if v_city is null then return jsonb_build_object('status','none'); end if;

  foreach v_segment in array regexp_split_to_array(p_text,'[,;()]') loop
    v_match := substring(v_segment from '((?:\S+\s+){0,4}(?:iela|ielā|gatve|gatvē|bulvāris|bulvārī|prospekts|prospektā|laukums|laukumā|šoseja|šosejā|ceļš|ceļā|aleja|alejā|krastmala|krastmalā|līnija|līnijā|dambis|dambī)\s+\d+(?:\s?[A-Za-z](?![[:alnum:]]))?(?:\s?[/-]\s?\d+[A-Za-z]?(?![[:alnum:]]))?)');
    continue when v_match is null;
    -- "Bibliotēka Kalēju iela 9": the longest street name the register knows wins,
    -- so "Lielā Dārza iela 5" is never read as "Dārza iela 5".
    v_words := regexp_split_to_array(btrim(v_match),'\s+');
    for i in 1..greatest(1,cardinality(v_words)-2) loop
      select jsonb_agg(jsonb_build_object('kods',a.kods,'std',a.std,'latitude',a.latitude,'longitude',a.longitude,
               'confirmed',v_city or exists(
                  select 1 from unnest(meets_private.std_locality_stems(a.std)) s where position(' '||s||' ' in v_stems)>0)))
        into v_found
        from meets_private.address_register a
       where a.house_key=meets_private.address_key(array_to_string(v_words[i:],' '))
         and meets_private.std_municipality_id(a.std)=p_municipality_id;
      if v_found is not null then
        v_hits := v_hits||v_found;
        exit;
      end if;
    end loop;
  end loop;

  select count(distinct h->>'kods'),count(distinct h->>'kods') filter (where (h->>'confirmed')::boolean)
    into v_total,v_confirmed from jsonb_array_elements(v_hits) h;
  if v_total=0 then return jsonb_build_object('status','none'); end if;
  if v_confirmed=1 then
    return (select (h-'confirmed')||jsonb_build_object('status','match') from jsonb_array_elements(v_hits) h
             where (h->>'confirmed')::boolean limit 1);
  end if;
  if v_confirmed=0 and v_total=1 then
    return (v_hits->0)-'confirmed'||jsonb_build_object('status','unconfirmed');
  end if;
  return jsonb_build_object('status','ambiguous','count',v_total);
end
$$;

-- ---------------------------------------------------------------------------
-- Step 2: known institutions
-- ---------------------------------------------------------------------------
-- A name without the words that only say whose institution it is.
create or replace function meets_private.location_name_core(p_name text)
returns text
language sql
immutable
set search_path to ''
as $$
  select btrim(regexp_replace(regexp_replace(coalesce(p_name,''),
    '(^|[\s,])(novada|novads|pagasta|pagasts|pilsētas|pilsēta|pašvaldības)(?=[\s,]|$)','\1','gi'),'\s+',' ','g'),' ,')
$$;

-- The whole name and each of its comma-separated parts that could name an institution
-- ("Skaistkalnes pagasts, Skaistkalnes tautas nams" -> also "Skaistkalnes tautas nams").
create or replace function meets_private.location_name_variants(p_name text)
returns text[]
language sql
immutable
set search_path to ''
as $$
  select coalesce(array_agg(distinct v),'{}') from (
    select meets_private.location_name_core(x) v
      from unnest(array[meets_private.location_base_hall_name(p_name)]
                  ||string_to_array(meets_private.location_base_hall_name(p_name),',')) x
  ) s
  where v !~ '[0-9]\s*[a-zA-Z]?$'
    and (select count(*) from regexp_split_to_table(meets_private.plain_text(meets_private.place_search_query(v,null)),' ') w where length(w)>3)>=2
$$;

-- status 'match': exactly one institution (one point) of the municipality has the
-- same name, word for word in both directions, and the text names its town or parish.
create or replace function meets_private.location_auto_institution_match(p_name text, p_text text, p_municipality_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_variants text[] := meets_private.location_name_variants(p_name);
  v_city boolean;
  v_stems text := ' '||meets_private.lv_stems(concat_ws(' ',p_name,p_text))||' ';
  v_hits jsonb;
  v_total integer;
  v_confirmed integer;
begin
  if p_municipality_id is null or cardinality(v_variants)=0 then return jsonb_build_object('status','none'); end if;
  select m.name ~ ' valstspilsēta$' into v_city from public.municipalities m where m.id=p_municipality_id;
  if v_city is null then return jsonb_build_object('status','none'); end if;

  select jsonb_agg(jsonb_build_object('isil',i.isil,'name',i.name,'address',i.address,
           'latitude',i.latitude,'longitude',i.longitude,
           'point',round(i.latitude::numeric,4)||','||round(i.longitude::numeric,4),
           'confirmed',v_city or exists(
              select 1 from unnest(meets_private.std_locality_stems(i.address)) s where position(' '||s||' ' in v_stems)>0))
           order by i.isil)
    into v_hits
    from meets_private.culture_institutions i
   where i.municipality_id=p_municipality_id and i.coord_check is not null
     and exists (
       select 1 from unnest(v_variants) v
        where meets_private.place_names_match(v,meets_private.location_name_core(i.name))
          and meets_private.place_names_match(meets_private.location_name_core(i.name),v));
  if v_hits is null then return jsonb_build_object('status','none'); end if;

  select count(distinct h->>'point'),count(distinct h->>'point') filter (where (h->>'confirmed')::boolean)
    into v_total,v_confirmed from jsonb_array_elements(v_hits) h;
  if v_total>1 then return jsonb_build_object('status','ambiguous','count',v_total); end if;
  return ((v_hits->0)-'confirmed'-'point')
         ||jsonb_build_object('status',case when v_confirmed=1 then 'match' else 'unconfirmed' end);
end
$$;

-- ---------------------------------------------------------------------------
-- Step 3: a bare town, village or parish name
-- ---------------------------------------------------------------------------
-- Every comma-separated part of the name must be a town, village or parish of the
-- municipality ("Priekules pilsēta, Priekule", "Iecavas pagasts", "Pope") and they
-- must agree on one place. The municipality's own name alone is not a place.
create or replace function meets_private.location_auto_settlement_match(p_name text, p_municipality_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_part text;
  v_plain text;
  v_kind text;
  v_stem text;
  v_municipality text;
  v_ids bigint[];
  v_specific bigint[];   -- towns and villages named
  v_parishes bigint[] := '{}';
  v_first boolean := true;
  v_kods bigint;
begin
  if p_municipality_id is null or btrim(coalesce(p_name,''))='' or p_name ~ '[0-9]' then
    return jsonb_build_object('status','none');
  end if;
  select meets_private.lv_stems(regexp_replace(m.name,' (novads|valstspilsēta)$','')) into v_municipality
    from public.municipalities m where m.id=p_municipality_id and m.name ~ ' (novads|valstspilsēta)$';
  if v_municipality is null then return jsonb_build_object('status','none'); end if;

  foreach v_part in array string_to_array(p_name,',') loop
    v_plain := meets_private.plain_text(v_part);
    continue when v_plain='';
    v_kind := case when v_plain ~ ' (pagasts|pagasta|pagasta|pag)$' then 'parish'
                   when v_plain ~ ' (pilseta|pilsetas)$' then 'city'
                   when v_plain ~ ' (ciems|ciema)$' then 'village'
                   when v_plain ~ ' (novads|novada|valstspilseta)$' then 'municipality' end;
    v_stem := meets_private.lv_stems(regexp_replace(v_plain,' (pagasts|pagasta|pag|pilseta|pilsetas|ciems|ciema|novads|novada|valstspilseta)$',''));
    if v_kind='municipality' then
      -- "…, Bauskas novads" only repeats the municipality.
      if v_stem=v_municipality then continue; end if;
      return jsonb_build_object('status','none');
    end if;
    select array_agg(c.kods) into v_ids
      from meets_private.place_centroids c
     where c.municipality_id=p_municipality_id and c.name_stem=v_stem
       and case when v_kind is null then c.kind in ('city','village') else c.kind=v_kind end;
    if v_ids is null then return jsonb_build_object('status','none'); end if;
    if v_kind='parish' then
      v_parishes := v_parishes||v_ids;
    elsif v_first then
      v_specific := v_ids; v_first := false;
    else
      v_specific := array(select unnest(v_specific) intersect select unnest(v_ids));
    end if;
  end loop;

  if v_specific is null then
    if cardinality(v_parishes)<>1 then
      return jsonb_build_object('status',case when cardinality(v_parishes)=0 then 'none' else 'ambiguous' end);
    end if;
    v_kods := v_parishes[1];
  else
    -- Two villages of one name in the municipality: the parish named with them decides.
    if cardinality(v_specific)>1 and cardinality(v_parishes)>0 then
      v_specific := array(
        select c.kods from meets_private.place_centroids c
         where c.kods=any(v_specific)
           and exists (select 1 from meets_private.place_centroids p
                        where p.kods=any(v_parishes) and position(p.name in c.std)>0));
    end if;
    if cardinality(v_specific)<>1 then
      return jsonb_build_object('status',case when cardinality(v_specific)=0 then 'none' else 'ambiguous' end);
    end if;
    v_kods := v_specific[1];
  end if;
  return (select jsonb_build_object('status','match','kods',c.kods,'kind',c.kind,'name',c.name,'std',c.std,
                   'latitude',c.latitude,'longitude',c.longitude)
            from meets_private.place_centroids c where c.kods=v_kods);
end
$$;

-- ---------------------------------------------------------------------------
-- Step 4: an address from the source page
-- ---------------------------------------------------------------------------
-- The addresses found on the event's page, without the ones the site prints on
-- its pages for three or more different places (the municipality's own address).
create or replace function meets_private.location_source_page_addresses(p_event_id uuid)
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(array_agg(a),'{}')
    from meets_private.location_source_addresses s
    cross join unnest(s.addresses) a
   where s.event_id=p_event_id
     and (select count(*) from meets_private.location_source_addresses d where d.domain=s.domain and d.status='ok')>=3
     and (select count(distinct meets_private.location_place_key(coalesce(nullif(btrim(l.venue_name),''),l.address_raw))
                              ||'|'||coalesce(l.municipality_id,0))
            from meets_private.location_source_addresses o
            join public.event_locations l on l.event_id=o.event_id
           where o.domain=s.domain
             and exists (select 1 from unnest(o.addresses) b
                          where meets_private.address_key(split_part(b,',',1))=meets_private.address_key(split_part(a,',',1))))<3
$$;

-- ---------------------------------------------------------------------------
-- The plan: one row per place (name + municipality) without a verified point
-- ---------------------------------------------------------------------------
do $$ begin
  create type meets_private.location_auto_plan_row as (
    place_key text, municipality_id bigint, municipality text, sample_name text, sample_address text,
    events integer, published integer, upcoming integer,
    decision text, method text, source_ref text, matched_label text, matched_address text,
    latitude double precision, longitude double precision, reason text, event_ids uuid[]);
exception when duplicate_object then null; end $$;

-- decision 'apply' (a new automatic place), 'existing' (an automatic place already
-- saved) or 'manual' (stays with the admin; reason says why). Reads only.
create or replace function meets_private.location_auto_plan(p_steps text[] default null)
returns setof meets_private.location_auto_plan_row
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_steps text[] := coalesce(p_steps,array['address_register','culture_institution','settlement_center']
    ||case when (select value from meets_private.app_settings where key='location_auto_source_pages')='on'
           then array['source_page_address'] else '{}'::text[] end);
  v_today date := (now() at time zone 'Europe/Riga')::date;
  g record;
  r meets_private.location_auto_plan_row;
  v_place meets_private.location_auto_places%rowtype;
  v_text text;
  v_alias text;
  v_event uuid;
  j jsonb;
  v_reg jsonb; v_reg_kods text[]; v_reg_ambiguous boolean; v_reg_unconfirmed jsonb; v_addressless integer;
  v_inst jsonb; v_inst_points text[]; v_inst_bad text;
  v_set jsonb; v_set_kods text[]; v_set_bad boolean;
  v_page jsonb; v_page_kods text[]; v_page_bad boolean;
  v_specific boolean;
  v_why text;
begin
  for g in
    select k.place_key,l.municipality_id,m.name municipality,
           count(*)::integer events,
           (count(*) filter (where e.status='published'))::integer published,
           (count(*) filter (where coalesce(e.date_to,e.date_from)>=v_today))::integer upcoming,
           array_agg(l.event_id order by l.event_id) event_ids,
           (array_agg(k.alias order by e.date_from desc,l.event_id))[1] sample_name,
           max(nullif(btrim(l.address_raw),'')) sample_address,
           array_agg(distinct k.alias) aliases,
           array_agg(distinct concat_ws(', ',k.alias,nullif(btrim(l.address_raw),k.alias),nullif(btrim(l.locality_text),''))) texts
      from public.event_locations l
      join public.events e on e.id=l.event_id
      left join public.municipalities m on m.id=l.municipality_id
      cross join lateral (select coalesce(nullif(btrim(l.venue_name),''),nullif(btrim(l.address_raw),''),'') alias) a
      cross join lateral (select a.alias,meets_private.location_place_key(a.alias) place_key) k
     where l.verified_at is null
       and l.location_auto_place_id is null
       and l.venue_point is null
       and e.status in ('pending_review','published')
       and coalesce(e.attendance_mode,'')<>'online'
       and coalesce(l.country_code,'LV')='LV'
     group by k.place_key,l.municipality_id,m.name
     order by count(*) desc,k.place_key
  loop
    r := null;
    r.place_key := g.place_key; r.municipality_id := g.municipality_id; r.municipality := g.municipality;
    r.sample_name := g.sample_name; r.sample_address := g.sample_address;
    r.events := g.events; r.published := g.published; r.upcoming := g.upcoming; r.event_ids := g.event_ids;
    r.decision := 'manual';

    if length(g.place_key)<3 then
      r.reason := 'Nav norises vietas nosaukuma';
      return next r; continue;
    elsif g.municipality_id is null then
      r.reason := 'Nav noteikts novads';
      return next r; continue;
    elsif g.municipality !~ ' (novads|valstspilsēta)$' then
      r.reason := 'Vieta nav vienā Latvijas pašvaldībā';
      return next r; continue;
    end if;

    select * into v_place from meets_private.location_auto_places p
     where p.place_key=g.place_key and p.municipality_id=g.municipality_id;
    if found then
      if v_place.active then
        r.decision := 'existing'; r.method := v_place.method; r.source_ref := v_place.source_ref;
        r.matched_label := v_place.label; r.matched_address := v_place.address;
        r.latitude := v_place.latitude; r.longitude := v_place.longitude;
        r.reason := 'Vietai jau ir automātisks punkts';
      else
        r.reason := 'Automātiskais punkts šai vietai ir atsaukts';
      end if;
      return next r; continue;
    end if;

    v_specific := (select count(*) from regexp_split_to_table(g.place_key,' ') w where length(w)>3)>=2;
    v_why := null;

    -- Step 1.
    v_reg := null; v_reg_kods := '{}'; v_reg_ambiguous := false; v_reg_unconfirmed := null; v_addressless := 0;
    foreach v_text in array g.texts loop
      j := meets_private.location_auto_register_match(v_text,g.municipality_id);
      case j->>'status'
        when 'match' then
          v_reg := j;
          if not (j->>'kods')=any(v_reg_kods) then v_reg_kods := v_reg_kods||(j->>'kods'); end if;
        when 'ambiguous' then v_reg_ambiguous := true;
        when 'unconfirmed' then v_reg_unconfirmed := j;
        else v_addressless := v_addressless+1;
      end case;
    end loop;
    if v_reg_ambiguous then
      v_reg := null; v_why := 'Adrešu reģistrā šai adresei novadā ir vairākas iespējamās vietas';
    elsif cardinality(v_reg_kods)>1 then
      v_reg := null; v_reg_ambiguous := true; v_why := 'Vienam vietas nosaukumam pasākumos ir dažādas adreses';
    elsif v_reg is not null and v_reg_unconfirmed is not null and v_reg_unconfirmed->>'kods'<>v_reg->>'kods' then
      v_reg := null; v_reg_ambiguous := true; v_why := 'Vienam vietas nosaukumam pasākumos ir dažādas adreses';
    elsif v_reg is not null and v_addressless>0 and not v_specific then
      v_reg := null; v_reg_ambiguous := true; v_why := 'Vispārīgs nosaukums, un daļai pasākumu adreses nav';
    elsif v_reg is null and v_reg_unconfirmed is not null then
      v_why := 'Adrese ir vienīgā novadā, bet tekstā nav nosaukta apdzīvotā vieta';
    end if;
    if not 'address_register'=any(v_steps) then v_reg := null; end if;

    -- Step 2.
    v_inst := null; v_inst_points := '{}'; v_inst_bad := null;
    if 'culture_institution'=any(v_steps) then
      foreach v_alias in array g.aliases loop
        j := meets_private.location_auto_institution_match(v_alias,array_to_string(g.texts,', '),g.municipality_id);
        case j->>'status'
          when 'match' then
            v_inst := j;
            if not (j->>'isil')=any(v_inst_points) then v_inst_points := v_inst_points||(j->>'isil'); end if;
          when 'ambiguous' then v_inst_bad := 'Iestāžu tabulā nosaukumam atbilst vairākas iestādes';
          when 'unconfirmed' then v_inst_bad := 'Iestāde atrasta pēc nosaukuma, bet tekstā nav nosaukta tās apdzīvotā vieta';
          else null;
        end case;
      end loop;
      if v_inst_bad is not null or cardinality(v_inst_points)>1 then
        v_inst := null; v_why := coalesce(v_why,v_inst_bad,'Iestāžu tabulā nosaukumam atbilst vairākas iestādes');
      end if;
    end if;

    -- Step 3.
    v_set := null; v_set_kods := '{}'; v_set_bad := false;
    if 'settlement_center'=any(v_steps) then
      foreach v_alias in array g.aliases loop
        j := meets_private.location_auto_settlement_match(v_alias,g.municipality_id);
        if j->>'status'='match' then
          v_set := j;
          if not (j->>'kods')=any(v_set_kods) then v_set_kods := v_set_kods||(j->>'kods'); end if;
        else
          v_set_bad := true;
          if j->>'status'='ambiguous' then v_why := coalesce(v_why,'Novadā ir vairākas apdzīvotas vietas ar šādu nosaukumu'); end if;
        end if;
      end loop;
      if v_set_bad or cardinality(v_set_kods)<>1 then v_set := null; end if;
    end if;

    -- Decide.
    if v_reg is not null and v_inst is not null
       and meets_private.points_distance_m((v_reg->>'latitude')::float8,(v_reg->>'longitude')::float8,
                                           (v_inst->>'latitude')::float8,(v_inst->>'longitude')::float8)>300 then
      r.reason := 'Adrešu reģistra un iestāžu tabulas punkti atšķiras vairāk par 300 m';
    elsif v_reg is not null then
      r.decision := 'apply'; r.method := 'address_register'; r.source_ref := 'var:'||(v_reg->>'kods');
      r.matched_label := split_part(v_reg->>'std',', ',1); r.matched_address := v_reg->>'std';
      r.latitude := (v_reg->>'latitude')::float8; r.longitude := (v_reg->>'longitude')::float8;
    elsif v_inst is not null and v_reg_ambiguous then
      r.reason := v_why;
    elsif v_inst is not null and v_reg_unconfirmed is not null
       and meets_private.points_distance_m((v_reg_unconfirmed->>'latitude')::float8,(v_reg_unconfirmed->>'longitude')::float8,
                                           (v_inst->>'latitude')::float8,(v_inst->>'longitude')::float8)>300 then
      r.reason := 'Adrešu reģistra un iestāžu tabulas punkti atšķiras vairāk par 300 m';
    elsif v_inst is not null then
      r.decision := 'apply'; r.method := 'culture_institution'; r.source_ref := 'kulturasdati:'||(v_inst->>'isil');
      r.matched_label := v_inst->>'name'; r.matched_address := v_inst->>'address';
      r.latitude := (v_inst->>'latitude')::float8; r.longitude := (v_inst->>'longitude')::float8;
    elsif v_set is not null then
      r.decision := 'apply'; r.method := 'settlement_center'; r.source_ref := 'vzd-centroid:'||(v_set->>'kods');
      r.matched_label := v_set->>'name'; r.matched_address := v_set->>'std';
      r.latitude := (v_set->>'latitude')::float8; r.longitude := (v_set->>'longitude')::float8;
    elsif 'source_page_address'=any(v_steps) and v_why is null then
      -- Step 4: only where nothing else was found.
      v_page := null; v_page_kods := '{}'; v_page_bad := false;
      foreach v_event in array g.event_ids loop
        foreach v_text in array meets_private.location_source_page_addresses(v_event) loop
          j := meets_private.location_auto_register_match(v_text||', '||g.sample_name,g.municipality_id);
          if j->>'status'='match' then
            v_page := j;
            if not (j->>'kods')=any(v_page_kods) then v_page_kods := v_page_kods||(j->>'kods'); end if;
          elsif j->>'status' in ('ambiguous','unconfirmed') then
            v_page_bad := true;
          end if;
        end loop;
      end loop;
      if v_page is not null and not v_page_bad and cardinality(v_page_kods)=1 then
        r.decision := 'apply'; r.method := 'source_page_address'; r.source_ref := 'var:'||(v_page->>'kods');
        r.matched_label := split_part(v_page->>'std',', ',1); r.matched_address := v_page->>'std';
        r.latitude := (v_page->>'latitude')::float8; r.longitude := (v_page->>'longitude')::float8;
      elsif v_page is not null or v_page_bad then
        r.reason := 'Avota lapā atrastas vairākas vai neskaidras adreses';
      end if;
    end if;

    if r.decision='apply' then
      if not meets_private.point_in_country('LV',r.latitude,r.longitude) then
        r.decision := 'manual'; r.reason := 'Atrastais punkts ir ārpus Latvijas robežas';
      elsif exists (
        select 1 from public.event_locations l2
         where l2.municipality_id=g.municipality_id and l2.verified_at is not null and l2.map_point is not null
           and meets_private.location_place_key(coalesce(nullif(btrim(l2.venue_name),''),l2.address_raw))=g.place_key
           and extensions.st_distance(l2.map_point,
                 extensions.st_setsrid(extensions.st_makepoint(r.longitude,r.latitude),4326)::extensions.geography)>150) then
        r.decision := 'manual'; r.reason := 'Tai pašai vietai citā pasākumā ir pārbaudīts punkts citur';
      end if;
      if r.decision='manual' then
        r.method := null; r.source_ref := null;
      end if;
    end if;
    if r.decision='manual' and r.reason is null then
      r.reason := coalesce(v_why,case
        when g.sample_name ~ '[0-9]' then 'Adrese nav atrasta adrešu reģistrā šajā novadā'
        else 'Nosaukums nav atrasts ne iestāžu tabulā, ne apdzīvoto vietu sarakstā' end);
    end if;
    return next r;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Loading the reference tables (edge function load-place-reference, service role)
-- ---------------------------------------------------------------------------
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
           url=excluded.url,coord_check=null,updated_at=now();
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
      perform meets_private.culture_institutions_check();
    end if;
    update meets_private.place_reference_load set state='done',finished_at=now() where kind=p_kind;
  end if;
  return jsonb_build_object('loaded',v_count);
end
$$;

create or replace function public.meets_place_reference_failed(p_kind text, p_error text)
returns void
language sql
security definer
set search_path to ''
as $$
  update meets_private.place_reference_load set state='failed',error=left(p_error,500) where kind=p_kind;
$$;

-- An institution's coordinates are trusted only when they agree with an official source:
-- within 300 m of its register address, or (no street address) within reach of the
-- centre of the town or village of its address. All must lie inside Latvia.
create or replace function meets_private.culture_institutions_check()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  update meets_private.culture_institutions i
     set coord_check=c.result
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
        from meets_private.culture_institutions i2
        cross join lateral (select meets_private.location_auto_register_match(i2.address,i2.municipality_id) j) reg
    ) c
   where c.isil=i.isil and i.coord_check is distinct from c.result;
  get diagnostics v_count=row_count;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- Step 4 interface (edge function extract-source-addresses, service role)
-- ---------------------------------------------------------------------------
-- The next source pages to read: places the first three steps could not resolve.
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
        from meets_private.location_auto_plan(array['address_register','culture_institution','settlement_center']) p
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

create or replace function public.meets_location_source_pages_store(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  insert into meets_private.location_source_addresses(event_id,source_url,domain,addresses,status,fetched_at)
  select (r->>'event_id')::uuid,r->>'url',coalesce(substring(r->>'url' from '^https?://([^/]+)'),''),
         coalesce(array(select jsonb_array_elements_text(r->'addresses')),'{}'),coalesce(r->>'status','ok'),now()
    from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) r
   where exists (select 1 from public.events e where e.id=(r->>'event_id')::uuid)
  on conflict(event_id) do update
     set source_url=excluded.source_url,domain=excluded.domain,addresses=excluded.addresses,
         status=excluded.status,fetched_at=now();
  get diagnostics v_count=row_count;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- Rights: nothing here is callable by visitors or signed-in users.
-- ---------------------------------------------------------------------------
revoke execute on function meets_private.lv_stems(text) from public,anon,authenticated;
revoke execute on function meets_private.location_place_key(text) from public,anon,authenticated;
revoke execute on function meets_private.std_municipality_id(text) from public,anon,authenticated;
revoke execute on function meets_private.std_locality_stems(text) from public,anon,authenticated;
revoke execute on function meets_private.point_in_country(text,double precision,double precision) from public,anon,authenticated;
revoke execute on function meets_private.points_distance_m(double precision,double precision,double precision,double precision) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_register_match(text,bigint) from public,anon,authenticated;
revoke execute on function meets_private.location_name_core(text) from public,anon,authenticated;
revoke execute on function meets_private.location_name_variants(text) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_institution_match(text,text,bigint) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_settlement_match(text,bigint) from public,anon,authenticated;
revoke execute on function meets_private.location_source_page_addresses(uuid) from public,anon,authenticated;
revoke execute on function meets_private.location_auto_plan(text[]) from public,anon,authenticated;
revoke execute on function meets_private.culture_institutions_check() from public,anon,authenticated;
revoke execute on function public.meets_place_reference_import(text,jsonb,boolean,boolean) from public,anon,authenticated;
revoke execute on function public.meets_place_reference_failed(text,text) from public,anon,authenticated;
revoke execute on function public.meets_location_source_pages_next(integer,boolean) from public,anon,authenticated;
revoke execute on function public.meets_location_source_pages_store(jsonb) from public,anon,authenticated;
grant execute on function public.meets_place_reference_import(text,jsonb,boolean,boolean) to service_role;
grant execute on function public.meets_place_reference_failed(text,text) to service_role;
grant execute on function public.meets_location_source_pages_next(integer,boolean) to service_role;
grant execute on function public.meets_location_source_pages_store(jsonb) to service_role;
