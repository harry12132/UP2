-- Run this file in Supabase Dashboard → SQL Editor.
-- Required first: Supabase Dashboard → Authentication → Third-Party Auth → connect Firebase project "up2-nz".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'up2-media',
  'up2-media',
  true,
  104857600,
  array['image/*', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "UP2 users upload their own post media" on storage.objects;
create policy "UP2 users upload their own post media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'up2-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = (select auth.jwt() ->> 'sub')
);

drop policy if exists "UP2 users upload their own event media" on storage.objects;
create policy "UP2 users upload their own event media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'up2-media'
  and (storage.foldername(name))[1] = 'events'
  and (storage.foldername(name))[3] = (select auth.jwt() ->> 'sub')
);

drop policy if exists "UP2 users delete their own media" on storage.objects;
create policy "UP2 users delete their own media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'up2-media'
  and (
    ((storage.foldername(name))[1] = 'posts' and (storage.foldername(name))[2] = (select auth.jwt() ->> 'sub'))
    or
    ((storage.foldername(name))[1] = 'events' and (storage.foldername(name))[3] = (select auth.jwt() ->> 'sub'))
  )
);
