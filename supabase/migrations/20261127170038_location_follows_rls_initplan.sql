-- Supabase advisor auth_rls_initplan: auth.uid() in these policies was evaluated for
-- every row. Wrapped in a sub-select it is evaluated once per statement. Same rules.

alter policy "account follows locations" on public.meets_user_location_follows
  with check ((select auth.uid()) = user_id);
alter policy "account reads own followed locations" on public.meets_user_location_follows
  using ((select auth.uid()) = user_id);
alter policy "account unfollows locations" on public.meets_user_location_follows
  using ((select auth.uid()) = user_id);
