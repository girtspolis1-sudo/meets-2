-- Explicitly keep organization profile writes authenticated-only.
revoke all on function public.meets_update_organization_profile(uuid,text,text,text,text,text,text,boolean) from public;
revoke all on function public.meets_update_organization_profile(uuid,text,text,text,text,text,text,boolean) from anon;
grant execute on function public.meets_update_organization_profile(uuid,text,text,text,text,text,text,boolean) to authenticated;

-- This reader is intentionally public because it only returns whitelisted public fields
-- and published/upcoming event data.
revoke all on function public.meets_public_organizer_profile(uuid) from public;
grant execute on function public.meets_public_organizer_profile(uuid) to anon, authenticated;
