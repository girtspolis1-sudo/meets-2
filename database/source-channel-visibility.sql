-- MEETS 2 source channel visibility.
-- Each source/website can be hidden from the public catalogue without deleting events
-- or changing the import schedule. Existing sources default to visible.

begin;

update public.sources
set map_visible = true
where map_visible is null;

alter table public.sources
  alter column map_visible set default true,
  alter column map_visible set not null;

create or replace function meets_private.admin_source_visibility_catalog(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  return jsonb_build_object(
    'sources',
    (
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
            'map_visible',s.map_visible,
            'municipality_id',s.municipality_id,
            'event_count',(select count(*) from public.event_sources es where es.source_id=s.id),
            'current_event_count',(
              select count(*)
              from public.event_sources es
              join public.events e on e.id=es.event_id
              where es.source_id=s.id
                and coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date
            ),
            'published_event_count',(
              select count(*)
              from public.event_sources es
              join public.events e on e.id=es.event_id
              where es.source_id=s.id
                and e.status='published'
                and coalesce(e.date_to,e.date_from) >= (now() at time zone 'Europe/Riga')::date
            )
          )
          order by coalesce(r.display_name,s.domain),s.domain
        ),
        '[]'::jsonb
      )
      from public.sources s
      left join meets_private.source_registry r on r.source_id=s.id
    )
  );
end
$$;

create or replace function meets_private.admin_update_source_visibility(
  p_session_token text,
  p_source_id bigint,
  p_map_visible boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.sources%rowtype;
begin
  if not meets_private.admin_session_valid(p_session_token) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  if p_source_id is null or p_map_visible is null then
    raise exception 'Invalid source visibility input' using errcode='22023';
  end if;

  update public.sources
  set map_visible=p_map_visible
  where id=p_source_id
  returning * into v_source;

  if not found then
    raise exception 'Source not found' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'id',v_source.id,
    'domain',v_source.domain,
    'map_visible',v_source.map_visible
  );
end
$$;

create or replace function public.meets_admin_source_visibility_catalog(p_session_token text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select meets_private.admin_source_visibility_catalog(p_session_token)
$$;

create or replace function public.meets_admin_update_source_visibility(
  p_session_token text,
  p_source_id bigint,
  p_map_visible boolean
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select meets_private.admin_update_source_visibility(p_session_token,p_source_id,p_map_visible)
$$;

revoke all on function public.meets_admin_source_visibility_catalog(text)
from public, anon, authenticated, service_role;
revoke all on function public.meets_admin_update_source_visibility(text,bigint,boolean)
from public, anon, authenticated, service_role;

grant execute on function public.meets_admin_source_visibility_catalog(text)
to anon, service_role;
grant execute on function public.meets_admin_update_source_visibility(text,bigint,boolean)
to anon, service_role;

notify pgrst, 'reload schema';

commit;
