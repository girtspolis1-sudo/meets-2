-- Private events and share links.
--
-- Every organizer event gets a share link (share_token). Visibility decides where
-- else it appears:
--   public  : draft -> pending_review -> MEETS review -> published (unchanged);
--   private : draft -> private. Never reviewed, never in the catalogue or on the
--             map; only people with the link see it.
-- The shared page and the printable flyer read one event by its token through
-- meets_shared_event(), which returns public fields only.

alter table public.meets_submissions
  add column if not exists visibility text not null default 'public',
  add column if not exists share_token uuid not null default gen_random_uuid();

alter table public.meets_submissions
  drop constraint if exists meets_submissions_visibility_check,
  add constraint meets_submissions_visibility_check check (visibility in ('public','private'));

alter table public.meets_submissions
  drop constraint if exists meets_submissions_share_token_key,
  add constraint meets_submissions_share_token_key unique (share_token);

alter table public.meets_submissions
  drop constraint if exists meets_submissions_status_check,
  add constraint meets_submissions_status_check check (status in
    ('draft','pending_review','published','rejected','declined','cancelled','private'));

-- A private event is never reviewed; a reviewed one is public.
alter table public.meets_submissions
  drop constraint if exists meets_submissions_visibility_status,
  add constraint meets_submissions_visibility_status check (
    (status <> 'private' or visibility = 'private')
    and (status not in ('pending_review','published','rejected','declined') or visibility = 'public'));

-- The token is made by the database and never changes, so a link stays valid
-- and cannot be chosen by the client.
create or replace function meets_private.submission_before_write()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op='INSERT' then
    new.share_token := gen_random_uuid();
  else
    new.share_token := old.share_token;
  end if;
  if new.status='pending_review' and (tg_op='INSERT' or old.status is distinct from 'pending_review') then
    new.submitted_at := now();
    new.review_reason := null;
  end if;
  return new;
end $function$;

-- Organizers may also create private events and edit them (no review), and turn
-- a private event public (status pending_review starts the usual review).
alter policy "submissions editors insert" on public.meets_submissions
  with check ((author_id = (select auth.uid()))
    and (status = any (array['draft','pending_review','private']))
    and (event_id is null)
    and public.meets_org_can_edit(organization_id));

alter policy "submissions insert for owner" on public.meets_submissions
  with check ((author_id = (select auth.uid()))
    and (status = any (array['draft','pending_review','private']))
    and (event_id is null)
    and exists (select 1 from public.meets_organizations o
      where o.id = meets_submissions.organization_id and o.owner_id = (select auth.uid())));

alter policy "submissions editors update" on public.meets_submissions
  using ((status = any (array['draft','rejected','private']))
    and public.meets_org_can_edit(organization_id))
  with check ((status = any (array['draft','pending_review','private']))
    and (event_id is null)
    and public.meets_org_can_edit(organization_id));

alter policy "submissions update drafts owner" on public.meets_submissions
  using ((status = any (array['draft','rejected','private']))
    and exists (select 1 from public.meets_organizations o
      where o.id = meets_submissions.organization_id and o.owner_id = (select auth.uid())))
  with check ((status = any (array['draft','pending_review','private']))
    and (event_id is null)
    and (author_id = (select auth.uid()))
    and exists (select 1 from public.meets_organizations o
      where o.id = meets_submissions.organization_id and o.owner_id = (select auth.uid())));

-- One event by its share link: private, waiting for review or published.
-- Drafts, returned, declined and cancelled events are not shown.
create or replace function public.meets_shared_event(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'title',s.title,'description',s.description,'category',s.category,
    'date_from',s.date_from,'date_to',s.date_to,'time_from',s.time_from,'time_to',s.time_to,
    'schedule_kind',s.schedule_kind,'recurrence_slots',s.recurrence_slots,'recurrence_note',s.recurrence_note,
    'venue_name',s.venue_name,'address',s.address,'latitude',s.latitude,'longitude',s.longitude,
    'price_status',s.price_status,'price_min',s.price_min,'price_max',s.price_max,
    'attendance_mode',s.attendance_mode,
    'online_url',case when s.attendance_mode in ('online','hybrid') then s.online_url end,
    'cover_image_path',s.cover_image_path,
    'visibility',s.visibility,'status',s.status,
    'event_id',case when s.status in ('published','pending_review') then s.event_id end,
    'organization',jsonb_build_object(
      'name',o.name,
      'id',case when o.is_public then o.id end,
      'slug',case when o.is_public then o.slug end))
  from public.meets_submissions s
  join public.meets_organizations o on o.id = s.organization_id
  where s.share_token = p_token
    and s.status in ('private','pending_review','published')
$function$;

revoke all on function public.meets_shared_event(uuid) from public;
grant execute on function public.meets_shared_event(uuid) to anon, authenticated;
