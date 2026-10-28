-- MEETS 2: profile pictures in Storage instead of inside the auth token.
-- The app stores only the public URL in user metadata (avatar_url).
-- Each user may write only inside a folder named after their own user id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meets-avatars', 'meets-avatars', true, 102400, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'meets-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'meets-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
