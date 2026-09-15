begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'repair-photos',
  'repair-photos',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists repair_photos_select_active_member on storage.objects;
create policy repair_photos_select_active_member
on storage.objects for select to authenticated
using (
  bucket_id = 'repair-photos'
  and private.is_active_member(
    case
      when (storage.foldername(name))[1] ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

-- Uploads use short-lived signed upload URLs issued only after the application
-- creates a tenant-scoped pending attachment record. No direct INSERT, UPDATE,
-- or DELETE policy is intentionally granted to authenticated users.

commit;
