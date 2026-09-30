-- MEETS 2 production data-quality audit.
-- Read-only queries. Run after imports and before a public release.

-- 1. Published coverage and missing map points.
select
  status,
  count(*) as events,
  count(*) filter(where latitude is null or longitude is null) as missing_coordinates,
  count(*) filter(where nullif(trim(municipality),'') is null) as missing_municipality
from public.event_overview
group by status
order by status;

-- 2. Actionable missing coordinates.
-- Excludes remote/not-applicable events.
select
  id,title,date_from,municipality,settlement,venue_name,
  location_precision,location_note
from public.event_overview
where status='published'
  and (latitude is null or longitude is null)
  and location_precision <> 'not_applicable'
order by municipality,date_from,title;

-- 3. LFF venues still requiring exact map review.
select
  v.venue_name,
  count(*) as events,
  min(v.date_from) as first_date,
  max(v.date_from) as last_date
from public.event_overview v
join public.event_sports_metadata sm on sm.event_id=v.id
join public.sports_competitions sc on sc.id=sm.competition_id
where v.status='published'
  and sc.governing_body='LFF'
  and (v.latitude is null or v.longitude is null)
group by v.venue_name
order by events desc,v.venue_name;

-- 4. Suspicious source pollution in venue/address fields.
select id,title,date_from,left(venue_name,180) as venue_name,length(venue_name) as venue_length
from public.event_overview
where status='published'
  and (length(coalesce(venue_name,''))>300 or length(coalesce(address_raw,''))>500)
order by greatest(length(coalesce(venue_name,'')),length(coalesce(address_raw,''))) desc;

-- 5. Duplicate candidates.
-- Time, competition and source match identity are included to avoid false positives
-- such as separate showings or different age-group competitions.
with active as (
  select
    v.id,v.title,v.date_from,v.time_from,v.venue_name,v.address_raw,v.municipality,
    sm.source_match_id,sc.competition_key
  from public.event_overview v
  left join public.event_sports_metadata sm on sm.event_id=v.id
  left join public.sports_competitions sc on sc.id=sm.competition_id
  where v.status='published'
)
select
  lower(regexp_replace(trim(title),'\s+',' ','g')) as normalized_title,
  date_from,
  time_from,
  lower(regexp_replace(trim(coalesce(venue_name,address_raw,municipality,'')),'\s+',' ','g')) as normalized_place,
  coalesce(competition_key,'') as competition_key,
  coalesce(source_match_id,'') as source_match_id,
  count(*) as rows,
  array_agg(id order by id) as ids
from active
group by 1,2,3,4,5,6
having count(*)>1
order by rows desc,normalized_title;

-- 6. Municipality spelling/coverage.
select country_code,municipality,count(*) as events
from public.event_overview
where status='published'
group by country_code,municipality
order by country_code,municipality nulls first;

-- 7. Baltic basketball location precision.
select
  v.country_code,
  v.location_precision,
  count(*) as events,
  count(*) filter(where v.municipality is null) as missing_municipality
from public.event_overview v
join public.event_sports_metadata sm on sm.event_id=v.id
left join public.sports_competitions sc on sc.id=sm.competition_id
where v.status='published'
  and lower(coalesce(sm.sport_format,sc.sport_format,''))='basketball'
group by v.country_code,v.location_precision
order by v.country_code,v.location_precision;
