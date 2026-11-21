-- Page-address matching and merging of per-day copies are for RSS feeds only
-- (RSS ↔ TVP HTML). ICS feeds keep matching by their own import key: on an
-- organizer's site one page can hold two sessions on the same day.
create or replace function public.meets_feed_event_match(
  p_feed_id bigint,p_import_key text,p_url text,p_date_from date,p_date_to date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_source bigint; v_format text; v_key text:=meets_private.tvp_url_key(p_url);
        v_id uuid; v_status text; v_by text; v_merged integer:=0;
        v_to date:=coalesce(p_date_to,p_date_from);
begin
  select source_id,feed_format into v_source,v_format from meets_private.calendar_feeds where id=p_feed_id;
  if v_format is distinct from 'rss' then v_key:=null; end if;
  select e.id,e.status,'import_key' into v_id,v_status,v_by from public.events e where e.import_key=p_import_key;
  if v_id is null and v_source is not null and v_key is not null then
    select e.id,e.status,'url' into v_id,v_status,v_by
      from public.events e
      left join public.event_locations l on l.event_id=e.id
     where exists(select 1 from public.event_sources es
                   where es.event_id=e.id and es.source_id=v_source
                     and meets_private.tvp_url_key(es.source_url)=v_key)
       and e.date_from<=v_to and coalesce(e.date_to,e.date_from)>=p_date_from
     order by (e.status<>'archived') desc,(e.date_from=p_date_from) desc,(l.verified_at is not null) desc,
              (e.status='published') desc,e.created_at,e.id
     limit 1;
  end if;
  if v_id is not null and v_status not in ('archived','cancelled') and v_source is not null and v_key is not null then
    update public.events d
       set status='archived',updated_at=now(),
           last_change_summary=left('Apvienots ar RSS pasākumu '||v_id::text,200)
     where d.id<>v_id and d.status not in ('archived','cancelled')
       and d.date_from<=v_to and coalesce(d.date_to,d.date_from)>=p_date_from
       and exists(select 1 from public.event_sources es
                   where es.event_id=d.id and es.source_id=v_source
                     and meets_private.tvp_url_key(es.source_url)=v_key);
    get diagnostics v_merged=row_count;
  end if;
  return jsonb_build_object('event_id',v_id,'status',v_status,'matched_by',v_by,'merged',v_merged);
end
$$;
revoke all on function public.meets_feed_event_match(bigint,text,text,date,date) from public,anon,authenticated;
grant execute on function public.meets_feed_event_match(bigint,text,text,date,date) to service_role;
