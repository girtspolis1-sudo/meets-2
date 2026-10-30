-- Run after the /admin that signs in with a MEETS account is live.
-- Removes the separate admin password, its account-wide lockout and the old
-- session tokens; admin access is now only a signed-in account in admin_users.

create or replace function meets_private.admin_session_valid(p_session_token text)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select meets_private.is_meets_admin()
$$;

revoke execute on function public.meets_admin_password_login(text,text) from public,anon,authenticated;
revoke execute on function public.meets_admin_password_ready() from public,anon,authenticated;
revoke execute on function public.meets_admin_setup_password(text,text,text) from public,anon,authenticated;
drop function if exists public.meets_admin_password_login(text,text);
drop function if exists public.meets_admin_password_ready();
drop function if exists public.meets_admin_setup_password(text,text,text);
drop function if exists meets_private.admin_password_login(text,text);
drop function if exists meets_private.admin_password_ready();

-- Admin RPCs no longer accept anonymous callers.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname like 'meets\_admin\_%'
  loop
    execute format('revoke execute on function %s from public,anon',f);
  end loop;
end
$$;

delete from meets_private.admin_sessions;
delete from meets_private.admin_password_credentials;
