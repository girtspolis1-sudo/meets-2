-- Admin sign-in moves to the normal MEETS account (Supabase Auth).
-- An account becomes an admin when its confirmed e-mail is on the allowlist.
-- Transition: admin_session_valid accepts the signed-in admin OR an old admin
-- session token, so the previous /admin keeps working until the new UI ships.
-- 20261030130000_remove_legacy_admin_login.sql then removes the old path.

create table if not exists meets_private.admin_email_allowlist(
  email text primary key check (email=lower(trim(email))),
  added_at timestamptz not null default now()
);
revoke all on meets_private.admin_email_allowlist from public,anon,authenticated;

insert into meets_private.admin_email_allowlist(email) values
  ('girts.polis@icloud.com'),
  ('girtspolis1@gmail.com')
on conflict do nothing;

-- Grants the role only after the e-mail is confirmed, so registering someone
-- else's address gives nothing; revokes it when the e-mail changes.
create or replace function meets_private.handle_meets_admin_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_allowed boolean;
begin
  v_allowed := new.email_confirmed_at is not null
    and exists(select 1 from meets_private.admin_email_allowlist a
                where a.email=lower(trim(coalesce(new.email,''))));
  if v_allowed then
    insert into public.admin_users(user_id,email)
    values(new.id,lower(new.email))
    on conflict(user_id) do update set email=excluded.email;
  else
    delete from public.admin_users where user_id=new.id;
  end if;
  return new;
end
$$;

drop trigger if exists meets_admin_on_auth_user_created on auth.users;
create trigger meets_admin_on_auth_user_created
  after insert or update of email,email_confirmed_at on auth.users
  for each row execute function meets_private.handle_meets_admin_user();

-- Backfill: existing confirmed accounts on the allowlist; drop anyone else.
insert into public.admin_users(user_id,email)
select u.id,lower(u.email) from auth.users u
 join meets_private.admin_email_allowlist a on a.email=lower(u.email)
 where u.email_confirmed_at is not null
on conflict(user_id) do update set email=excluded.email;
delete from public.admin_users au
 where not exists(select 1 from auth.users u
   join meets_private.admin_email_allowlist a on a.email=lower(u.email)
   where u.id=au.user_id and u.email_confirmed_at is not null);

-- Every admin RPC goes through this check.
create or replace function meets_private.admin_session_valid(p_session_token text)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select meets_private.is_meets_admin()
      or (p_session_token is not null
          and exists(select 1 from meets_private.admin_sessions s
                      where s.token_hash=encode(extensions.digest(p_session_token,'sha256'),'hex')
                        and s.expires_at > now()))
$$;

-- Signed-in admins call the RPCs with their account token (role authenticated).
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname like 'meets\_admin\_%'
       and p.prosecdef
       and p.proname not in ('meets_admin_password_login','meets_admin_password_ready','meets_admin_setup_password')
  loop
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end
$$;

-- The weekly municipality import starts Wednesdays 03:00 UTC and finishes in
-- about two hours; the worker only needs to run in that window.
select cron.alter_job(jobid,schedule=>'*/10 3-9 * * 3')
  from cron.job where jobname='meets-municipalities-weekly-worker';
