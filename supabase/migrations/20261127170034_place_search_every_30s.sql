-- place_search_tick ran every 10 seconds (8 640 runs a day), although the queue is
-- empty most of the time: about 10–50 places a day are searched. It sends at most one
-- OpenStreetMap request per run, so every 30 seconds still searches 2 places a minute
-- (120 an hour), enough for a day of new places within minutes. The admin page only
-- shows the progress; nobody waits for a single answer.
-- A run with nothing requested or queued now returns at once, with the same result
-- the full run gives in that case. The rest of the function is unchanged.

create or replace function meets_private.place_search_tick()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r record;
  v_response record;
  v_candidates jsonb;
  v_known jsonb;
  v_done integer := 0;
  v_sent boolean := false;
begin
  -- Nothing waiting for an answer and nothing to search: nothing to do.
  if not exists(select 1 from meets_private.place_search_queue where state in ('requested','queued')) then
    return jsonb_build_object('stored',0,'sent',false);
  end if;

  if not pg_try_advisory_xact_lock(201026,1131) then return jsonb_build_object('state','busy'); end if;

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

  for r in select q.venue_name,q.address_text,m.name municipality from meets_private.place_search_queue q
             left join public.municipalities m on m.id=q.municipality_id
            where q.state='queued' and q.known_checked_at is null
            order by q.event_count desc,q.venue_name limit 20 loop
    v_known := meets_private.address_register_lookup(concat_ws(', ',r.venue_name,r.address_text),r.municipality);
    if jsonb_array_length(v_known)>0 then
      perform meets_private.place_search_store(r.venue_name,'Valsts adrešu reģistrs',v_known,'Valsts adrešu reģistrs');
      v_done := v_done+1;
      continue;
    end if;
    select coalesce(jsonb_agg(x),'[]'::jsonb) into v_known
      from jsonb_array_elements(meets_private.match_known_places(r.venue_name,r.municipality)) x
     where (x->>'score')::numeric>=0.75 and coalesce((x->>'sameArea')::boolean,true)
       and meets_private.place_names_match(r.venue_name,(x->>'label')||' '||coalesce(x->>'displayName',''));
    if jsonb_array_length(v_known)>0 then
      perform meets_private.place_search_store(r.venue_name,'MEETS zināmās vietas',v_known,'MEETS');
      v_done := v_done+1;
    else
      update meets_private.place_search_queue set known_checked_at=now() where venue_name=r.venue_name;
    end if;
  end loop;

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
$function$;

select cron.alter_job(jobid, schedule := '30 seconds') from cron.job where jobname = 'meets-place-search';
