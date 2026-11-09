-- Tournaments linked to an event, for the event's public pages.
-- An organizer links a tournament to an event (meets_tournaments.submission_id);
-- the event page (/pasakumi/[id]) and its share link (/ielugums/[token]) then
-- show a link to the tournament's results page. Only published tournaments,
-- and only for events that page may show: a published event by its id, or an
-- event with a working share link (private, in review or published) by its token.
create or replace function public.meets_event_tournaments(p_event_id uuid default null, p_share_token uuid default null)
 returns jsonb language sql stable security definer set search_path to ''
as $function$
 select coalesce(jsonb_agg(jsonb_build_object(
   'title', t.title, 'sport', t.sport, 'play_date', t.play_date, 'share_token', t.share_token
  ) order by t.play_date nulls last, t.created_at), '[]'::jsonb)
 from public.meets_tournaments t
 join public.meets_submissions s on s.id = t.submission_id
 where t.status = 'published'
   and ((p_event_id is not null and s.event_id = p_event_id and s.status in ('published','pending_review'))
     or (p_share_token is not null and s.share_token = p_share_token and s.status in ('private','pending_review','published')));
$function$;
revoke all on function public.meets_event_tournaments(uuid, uuid) from public;
grant execute on function public.meets_event_tournaments(uuid, uuid) to anon, authenticated;
