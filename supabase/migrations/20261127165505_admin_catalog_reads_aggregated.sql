-- The admin panel loads these three lists when it opens and after every action.
-- Each counted or aggregated per row with correlated subqueries (per event, per data
-- source, per place mapping). Now every count or list is built once with GROUP BY and
-- joined. Results are unchanged: each new body was compared with the previous one
-- (equal jsonb; catalog rows for p_past false and true).
-- Buffer pages: source visibility 69 306 -> about 2 000, place mappings 31 730 -> 1 364.

create or replace function meets_private.read_admin_catalog_rows(p_session_token text, p_past boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  return jsonb_build_object(
    'fetchedAt',now(),
    'fields',jsonb_build_array('id','title','description','date_from','date_to','time_from','time_to','time_type',
      'attendance_mode','record_type','event_type','primary_category','status','price_status','price_min','price_max',
      'venue_name','address_raw','location_precision','municipality','settlement','country_code','latitude','longitude',
      'location_quality','location_review_reason','geocode_query','geocode_candidates','geocode_suggested_at',
      'governing_body','competition_name','sport_format','tags','sources','location_auto'),
    'rows',(
      with tags as (
        select ec.event_id, jsonb_agg(c.name order by c.name) as tags
        from public.event_categories ec
        join public.categories c on c.id=ec.category_id
        group by ec.event_id
      ),
      src as (
        select es.event_id,
               jsonb_agg(jsonb_build_object('source',s.domain,'url',es.source_url,
                 'via',(select jsonb_agg(k order by k) from jsonb_object_keys(es.seen_via) k),
                 'seen',nullif(es.seen_via,'{}'::jsonb)) order by es.id) as sources
        from public.event_sources es
        join public.sources s on s.id=es.source_id
        group by es.event_id
      )
      select coalesce(jsonb_agg(jsonb_build_array(
        c.id,c.title,c.description,c.date_from,c.date_to,c.time_from,c.time_to,c.time_type,
        c.attendance_mode,c.record_type,c.event_type,c.primary_category,c.status,c.price_status,c.price_min,c.price_max,
        c.venue_name,c.address_raw,c.location_precision,c.municipality,c.settlement,c.country_code,c.latitude,c.longitude,
        c.location_quality,c.location_review_reason,c.geocode_query,c.geocode_candidates,c.geocode_suggested_at,
        c.governing_body,c.competition_name,c.sport_format,c.tags,c.sources,c.location_auto
      ) order by c.date_from,c.id),'[]'::jsonb)
      from (
        select v.id,v.title,left(regexp_replace(coalesce(v.description,''),'\s+',' ','g'),300) as description,
               v.date_from,v.date_to,v.time_from,v.time_to,v.time_type,v.attendance_mode,v.record_type,v.event_type,
               v.primary_category,v.status,v.price_status,v.price_min,v.price_max,
               v.venue_name,v.address_raw,v.location_precision,v.municipality,v.settlement,v.country_code,
               round(v.latitude::numeric,6) as latitude,round(v.longitude::numeric,6) as longitude,
               l.location_quality,l.location_review_reason,l.geocode_query,
               nullif(l.geocode_candidates,'[]'::jsonb) as geocode_candidates,l.geocode_suggested_at,
               sc.governing_body,sc.name as competition_name,coalesce(sm.sport_format,sc.sport_format) as sport_format,
               tags.tags,
               coalesce(src.sources,'[]'::jsonb) as sources,
               ap.method as location_auto
          from public.event_overview v
          left join public.event_locations l on l.event_id=v.id
          left join public.event_sports_metadata sm on sm.event_id=v.id
          left join public.sports_competitions sc on sc.id=sm.competition_id
          left join tags on tags.event_id=v.id
          left join src on src.event_id=v.id
          left join meets_private.location_auto_places ap on ap.id=l.location_auto_place_id and ap.active
         where case when p_past
                 then coalesce(v.date_to,v.date_from) between (now() at time zone 'Europe/Riga')::date-14 and (now() at time zone 'Europe/Riga')::date-1
                 else coalesce(v.date_to,v.date_from)>=(now() at time zone 'Europe/Riga')::date end
      ) c
    )
  );
end
$function$;

create or replace function meets_private.admin_source_visibility_catalog(p_session_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  return jsonb_build_object(
    'sources',
    (
      with counts as (
        -- Event counts of every source in one pass.
        select es.source_id,
               count(*) as event_count,
               count(*) filter (where coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date) as current_event_count,
               count(*) filter (where e.status='published'
                                  and coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date) as published_event_count
        from public.event_sources es
        left join public.events e on e.id=es.event_id
        group by es.source_id
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',s.id,
            'domain',s.domain,
            'label',coalesce(r.display_name,
              case
                when s.domain='lff.lv' then 'LFF'
                when s.domain='athletics.lv' then 'Athletics.lv'
                when s.domain='basket.lv' then 'Basket.lv'
                when s.domain='estlatbl.com' then 'Latvijas–Igaunijas basketbola līga'
                when s.domain='rbl.basket.lv' then 'Ramirent Nacionālā basketbola līga'
                when s.domain='nbl.basket.lv' then 'Nacionālā basketbola līga'
                when s.domain='ljbl.basket.lv' then 'Latvijas Jaunatnes basketbola līga'
                else s.domain
              end
            ),
            'calendar_url',s.calendar_url,
            'last_read_at',r.last_read_at,
            'last_status',r.last_status,
            'last_result',r.last_result,
            'weekly_last_attempt',wr.finished_at,
            'weekly_last_status',wr.state,
            'weekly_last_detail',wr.detail,
            'weekly_active_count',wb.event_count,
            'weekly_active_at',wb.created_at,
            'weekly_backup_count',(select count(*) from meets_private.municipality_sync_backups b where b.source_id=s.id),
            'weekly_last_added',wr.added_count,
            'map_visible',s.map_visible,
            'municipality_id',s.municipality_id,
            'event_count',coalesce(c.event_count,0),
            'current_event_count',coalesce(c.current_event_count,0),
            'published_event_count',coalesce(c.published_event_count,0)
          )
          order by coalesce(r.display_name,s.domain),s.domain
        ),
        '[]'::jsonb
      )
      from public.sources s
      left join meets_private.source_registry r on r.source_id=s.id
      left join counts c on c.source_id=s.id
      -- The latest weekly run of the source (one row instead of four lookups).
      left join lateral (
        select sr.finished_at, sr.state, sr.detail, sr.added_count
        from meets_private.municipality_sync_source_runs sr
        where sr.source_id=s.id
        order by coalesce(sr.finished_at,(select mr.started_at from meets_private.municipality_sync_runs mr where mr.id=sr.run_id)) desc
        limit 1
      ) wr on true
      left join lateral (
        select b.event_count, b.created_at
        from meets_private.municipality_sync_backups b
        where b.source_id=s.id
        order by b.created_at desc,b.id desc
        limit 1
      ) wb on true
    )
  );
end
$function$;

create or replace function meets_private.admin_location_mapping_catalog(p_session_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  return jsonb_build_object(
    'mappings',
    (
      with lc as (
        -- Events placed by each mapping, counted once.
        select l.location_source,
               count(*) as total_events,
               count(*) filter (where coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date) as current_events
        from public.event_locations l
        left join public.events e on e.id=l.event_id
        where l.location_source like 'admin mapping:%'
        group by l.location_source
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',m.id,
            'alias_text',m.alias_text,
            'original_address_text',m.original_address_text,
            'municipality',mu.name,
            'municipality_id',m.municipality_id,
            'country_code',m.country_code,
            'canonical_venue_name',m.canonical_venue_name,
            'canonical_address_text',m.canonical_address_text,
            'latitude',m.latitude,
            'longitude',m.longitude,
            'active',m.active,
            'apply_count',m.apply_count,
            'current_events',coalesce(lc.current_events,0),
            'total_events',coalesce(lc.total_events,0),
            'created_by',m.created_by,
            'updated_by',m.updated_by,
            'deactivated_at',m.deactivated_at,
            'last_applied_at',m.last_applied_at,
            'created_at',m.created_at,
            'updated_at',m.updated_at
          )
          order by m.active desc,m.updated_at desc,m.alias_text
        ),
        '[]'::jsonb
      )
      from meets_private.location_alias_mappings m
      left join public.municipalities mu on mu.id=m.municipality_id
      left join lc on lc.location_source='admin mapping:'||m.id::text
    )
  );
end
$function$;
