-- Basketball import preparation
-- Adds normalized basketball metadata to discovery items,
-- resolves current regional fixtures with missing venues to conservative locality fallbacks,
-- and exposes a deduplicated LJBL youth import queue.

alter table public.basketball_discovery_items
  add column if not exists basketball_level text,
  add column if not exists age_group text,
  add column if not exists gender text,
  add column if not exists competition_name text,
  add column if not exists location_status text,
  add column if not exists resolved_locality text,
  add column if not exists resolved_lat double precision,
  add column if not exists resolved_lon double precision,
  add column if not exists location_basis text,
  add column if not exists location_confidence text,
  add column if not exists import_ready boolean not null default false;

create index if not exists basketball_discovery_items_import_ready_idx
  on public.basketball_discovery_items(run_id, import_ready);

update public.basketball_sources
set division = case
  when section<>'LJBL' then division
  when competition ilike '%Superlīga%' then 'Superlīga'
  when competition ilike '%Nacionālā līga Austrumi%' then 'Nacionālā līga — Austrumi'
  when competition ilike '%Nacionālā līga Centrs%' then 'Nacionālā līga — Centrs'
  when competition ilike '%Nacionālā līga Rietumi%' then 'Nacionālā līga — Rietumi'
  when competition ilike '%Nacionālā līga%' then 'Nacionālā līga'
  when competition ilike '%kauss%' then 'Nacionālās līgas kauss'
  else 'Pamatgrupa'
end
where section='LJBL';

with latest as (
  select id from public.basketball_discovery_runs
  where status='complete'
  order by created_at desc
  limit 1
)
update public.basketball_discovery_items i
set
  basketball_level=s.basketball_level,
  age_group=s.age_group,
  gender=s.gender,
  competition_name=s.competition
from latest l
join public.basketball_sources s on true
where i.run_id=l.id
  and s.source_key=i.source_key;

-- Conservative locality fallback only. These are not represented as exact venue coordinates.
with latest as (
  select id from public.basketball_discovery_runs
  where status='complete'
  order by created_at desc
  limit 1
)
update public.basketball_discovery_items i
set
  resolved_locality = case
    when i.source_key='regionalie-turniri:179' then 'Ogre'
    when i.source_key='regionalie-turniri:168' then 'Jūrmala'
    when i.source_key='regionalie-turniri:166' then 'Ventspils'
    when i.source_key='regionalie-turniri:180' and i.home_team ilike 'Kandavas%' then 'Kandava'
    when i.source_key='regionalie-turniri:180' and i.home_team='Engure' then 'Engure'
    when i.source_key='regionalie-turniri:180' and i.home_team='Jaunpils' then 'Jaunpils'
    when i.source_key='regionalie-turniri:180' and i.home_team='Stende' then 'Stende'
    when i.source_key='regionalie-turniri:180' and i.home_team ilike 'Saldus%' then 'Saldus'
    when i.source_key='regionalie-turniri:180' and i.home_team='Lapmežciems' then 'Lapmežciems'
    when i.source_key='regionalie-turniri:180' and i.home_team='Ošenieki/Šķēde' then 'Saldus'
    when i.source_key='regionalie-turniri:180' then 'Tukums'
    else null
  end,
  resolved_lat = case
    when i.source_key='regionalie-turniri:179' then 56.8192045
    when i.source_key='regionalie-turniri:168' then 56.9727164
    when i.source_key='regionalie-turniri:166' then 57.3903918
    when i.source_key='regionalie-turniri:180' and i.home_team ilike 'Kandavas%' then 57.0400
    when i.source_key='regionalie-turniri:180' and i.home_team='Engure' then 57.1608
    when i.source_key='regionalie-turniri:180' and i.home_team='Jaunpils' then 56.7310
    when i.source_key='regionalie-turniri:180' and i.home_team='Stende' then 57.1440
    when i.source_key='regionalie-turniri:180' and i.home_team ilike 'Saldus%' then 56.6636
    when i.source_key='regionalie-turniri:180' and i.home_team='Lapmežciems' then 57.0007
    when i.source_key='regionalie-turniri:180' and i.home_team='Ošenieki/Šķēde' then 56.6636
    when i.source_key='regionalie-turniri:180' then 56.9669816
    else null
  end,
  resolved_lon = case
    when i.source_key='regionalie-turniri:179' then 24.6074393
    when i.source_key='regionalie-turniri:168' then 23.7886979
    when i.source_key='regionalie-turniri:166' then 21.5635991
    when i.source_key='regionalie-turniri:180' and i.home_team ilike 'Kandavas%' then 22.7747
    when i.source_key='regionalie-turniri:180' and i.home_team='Engure' then 23.2252
    when i.source_key='regionalie-turniri:180' and i.home_team='Jaunpils' then 23.0120
    when i.source_key='regionalie-turniri:180' and i.home_team='Stende' then 22.5347
    when i.source_key='regionalie-turniri:180' and i.home_team ilike 'Saldus%' then 22.4881
    when i.source_key='regionalie-turniri:180' and i.home_team='Lapmežciems' then 23.5137
    when i.source_key='regionalie-turniri:180' and i.home_team='Ošenieki/Šķēde' then 22.4881
    when i.source_key='regionalie-turniri:180' then 23.1524528
    else null
  end,
  location_status='resolved_fallback',
  location_basis=case
    when i.source_key='regionalie-turniri:180'
      and (
        i.home_team in ('Engure','Jaunpils','Stende','Lapmežciems')
        or i.home_team ilike 'Kandavas%'
        or i.home_team ilike 'Saldus%'
      )
      then 'home-team locality inference; source fixture has no venue'
    else 'competition locality fallback; source fixture has no venue'
  end,
  location_confidence=case
    when i.source_key='regionalie-turniri:180'
      and (
        i.home_team in ('Engure','Jaunpils','Stende','Lapmežciems')
        or i.home_team ilike 'Kandavas%'
        or i.home_team ilike 'Saldus%'
      )
      then 'medium'
    else 'low'
  end
from latest l
where i.run_id=l.id
  and coalesce(i.venue_name,'')=''
  and i.source_key in ('regionalie-turniri:166','regionalie-turniri:168','regionalie-turniri:179','regionalie-turniri:180');

with latest as (
  select id from public.basketball_discovery_runs
  where status='complete'
  order by created_at desc
  limit 1
)
update public.basketball_discovery_items i
set import_ready=(
  not i.duplicate_in_discovery
  and not i.already_in_meets
  and i.date_from is not null
  and i.home_team is not null
  and i.away_team is not null
  and (
    coalesce(i.venue_name,'')<>''
    or (i.resolved_lat is not null and i.resolved_lon is not null)
  )
)
from latest l
where i.run_id=l.id;

create or replace view public.basketball_ljbl_import_ready_v as
with latest as (
  select id
  from public.basketball_discovery_runs
  where status='complete'
  order by created_at desc
  limit 1
)
select
  i.id as discovery_item_id,
  i.run_id,
  i.import_key,
  i.source_match_id,
  i.source_key,
  'Basketbols'::text as primary_category,
  'sports_match'::text as event_type,
  'youth'::text as basketball_level,
  i.age_group,
  i.gender,
  s.division,
  i.competition_name,
  i.home_team,
  i.away_team,
  i.date_from,
  i.time_from,
  i.venue_name,
  i.resolved_locality,
  i.resolved_lat,
  i.resolved_lon,
  i.location_status,
  i.location_basis,
  i.location_confidence,
  i.source_url,
  i.raw_data
from public.basketball_discovery_items i
join latest l on l.id=i.run_id
join public.basketball_sources s on s.source_key=i.source_key
where i.source_key like 'ljbl:%'
  and i.import_ready=true
  and i.duplicate_in_discovery=false
  and i.already_in_meets=false;
