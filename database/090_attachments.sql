begin;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ticket_id uuid not null,
  uploaded_by uuid not null,
  photo_slot smallint not null check (photo_slot between 1 and 2),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  size_bytes integer check (size_bytes between 1 and 1048576),
  media_type text check (media_type in ('image/jpeg', 'image/png', 'image/webp')),
  width integer check (width is null or width between 1 and 6000),
  height integer check (height is null or height between 1 and 6000),
  upload_state text not null default 'pending'
    check (upload_state in ('pending', 'ready', 'failed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attachments_tenant_key unique (organization_id, id),
  constraint attachments_ticket_photo_slot_key
    unique (organization_id, ticket_id, photo_slot),
  constraint attachments_storage_path_key unique (storage_path),
  constraint attachments_ticket_fk
    foreign key (organization_id, ticket_id)
    references public.tickets (organization_id, id),
  constraint attachments_uploader_membership_fk
    foreign key (organization_id, uploaded_by)
    references public.memberships (organization_id, user_id),
  constraint attachments_ready_metadata check (
    upload_state <> 'ready'
    or (size_bytes is not null and media_type is not null
        and width is not null and height is not null)
  )
);

create index attachments_organization_ticket_idx
  on public.attachments (organization_id, ticket_id, created_at, id);

create index attachments_abandoned_cleanup_idx
  on public.attachments (upload_state, created_at)
  where upload_state = 'pending';

create trigger attachments_set_updated_at
before update on public.attachments
for each row execute function private.set_updated_at();

commit;
