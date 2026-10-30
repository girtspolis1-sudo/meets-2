-- MEETS 2: imported events nobody reviewed before they ended are archived daily.
-- They can no longer be published, and they kept the admin review queue growing.
-- Imports set status only when creating an event, so an archived event stays archived.

create or replace function meets_private.archive_past_pending_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with archived as (
    update public.events
    set status = 'archived', updated_at = now()
    where status = 'pending_review'
      and coalesce(date_to, date_from) < (now() at time zone 'Europe/Riga')::date
    returning 1
  )
  select count(*)::integer from archived
$$;
revoke all on function meets_private.archive_past_pending_events() from public, anon, authenticated;

-- 00:20 UTC = 02:20/03:20 Riga, after the day has ended in Latvia.
select cron.schedule('meets-archive-past-pending', '20 0 * * *', 'select meets_private.archive_past_pending_events();');
