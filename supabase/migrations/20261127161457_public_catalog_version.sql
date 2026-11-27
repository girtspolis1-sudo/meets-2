-- The time the stored public catalogue was built. The site asks this first and loads
-- the whole catalogue (about 11 MB) only when it has changed. It reads built_at only:
-- the data column is stored out of line and is not touched.
-- Server only, like meets_public_catalog(): never called from the browser.

create or replace function public.meets_public_catalog_version()
 returns timestamptz
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select built_at from meets_private.public_catalog_snapshot where id = 1
$function$;
revoke all on function public.meets_public_catalog_version() from public, anon, authenticated;
grant execute on function public.meets_public_catalog_version() to anon, service_role;
comment on function public.meets_public_catalog_version() is
  'MEETS 2: build time of the stored public catalogue (equals fetchedAt of meets_public_catalog()).';

notify pgrst, 'reload schema';
