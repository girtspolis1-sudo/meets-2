-- Admin authentication transition:
-- Supabase Auth verifies the admin email/password, then exchanges the authenticated
-- user identity for the existing short-lived MEETS admin session token.

create or replace function meets_private.admin_auth_exchange()
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid;
  v_token text;
begin
  v_user_id := auth.uid();

  if v_user_id is null
     or not exists(
       select 1
       from public.admin_users
       where user_id=v_user_id
     )
  then
    raise exception 'Unauthorized' using errcode='42501';
  end if;

  delete from meets_private.admin_sessions
  where expires_at <= now();

  v_token := encode(extensions.gen_random_bytes(32),'hex');

  insert into meets_private.admin_sessions(token_hash,expires_at)
  values(
    encode(extensions.digest(v_token,'sha256'),'hex'),
    now()+interval '8 hours'
  );

  return v_token;
end
$$;

revoke all on function meets_private.admin_auth_exchange()
from public, anon;
grant execute on function meets_private.admin_auth_exchange()
to authenticated, service_role;

create or replace function public.meets_admin_exchange_auth()
returns text
language sql
set search_path=''
as $$
  select meets_private.admin_auth_exchange()
$$;

revoke all on function public.meets_admin_exchange_auth()
from public, anon;
grant execute on function public.meets_admin_exchange_auth()
to authenticated, service_role;
