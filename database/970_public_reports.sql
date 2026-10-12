begin;

-- Public fault reports: untrusted intake from a QR scan by someone without an
-- account. A report never changes equipment condition, tickets or costs. The
-- owner accepts it into exactly one ticket, or dismisses it.
--
-- Custom SQLSTATE codes:
--   RL020 too many reports from this device or for this machine
--   RL021 the café's review inbox is full
--   RL022 the report was already dismissed
--   RL023 the report was already accepted

create table if not exists public.public_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  equipment_id uuid not null,
  client_request_id uuid not null,
  description text not null check (char_length(description) between 1 and 2000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  accepted_ticket_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  -- Salted hash of the reporter's network address, used only for rate
  -- limiting. The raw address is never stored.
  reporter_fingerprint text not null check (reporter_fingerprint ~ '^[0-9a-f]{64}$'),
  -- Lets the same visitor attach photos for a short time after submitting.
  upload_token_hash bytea not null,
  upload_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint public_reports_tenant_key unique (organization_id, id),
  constraint public_reports_idempotency_key unique (equipment_id, client_request_id),
  constraint public_reports_equipment_fk
    foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id),
  constraint public_reports_ticket_fk
    foreign key (organization_id, accepted_ticket_id)
    references public.tickets (organization_id, id),
  constraint public_reports_reviewer_membership_fk
    foreign key (organization_id, reviewed_by)
    references public.memberships (organization_id, user_id),
  constraint public_reports_review_consistency check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null
      and accepted_ticket_id is null)
    or (status = 'accepted' and reviewed_at is not null and reviewed_by is not null
      and accepted_ticket_id is not null)
    or (status = 'dismissed' and reviewed_at is not null and reviewed_by is not null
      and accepted_ticket_id is null)
  )
);

create index if not exists public_reports_organization_status_idx
  on public.public_reports (organization_id, status, created_at desc);

create index if not exists public_reports_fingerprint_idx
  on public.public_reports (reporter_fingerprint, created_at desc);

create index if not exists public_reports_equipment_idx
  on public.public_reports (equipment_id, created_at desc);

create table if not exists public.public_report_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  report_id uuid not null,
  photo_slot smallint not null check (photo_slot between 1 and 2),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  size_bytes integer not null check (size_bytes between 1 and 1048576),
  media_type text not null check (media_type = 'image/jpeg'),
  width integer not null check (width between 1 and 6000),
  height integer not null check (height between 1 and 6000),
  created_at timestamptz not null default now(),
  constraint public_report_photos_slot_key unique (report_id, photo_slot),
  constraint public_report_photos_storage_path_key unique (storage_path),
  constraint public_report_photos_report_fk
    foreign key (organization_id, report_id)
    references public.public_reports (organization_id, id)
);

alter table public.public_reports enable row level security;
alter table public.public_report_photos enable row level security;

revoke all on table public.public_reports, public.public_report_photos
  from anon, authenticated;

-- Owners review reports. The fingerprint and upload token stay unreadable.
grant select (
  id,
  organization_id,
  equipment_id,
  description,
  status,
  accepted_ticket_id,
  reviewed_by,
  reviewed_at,
  created_at
) on public.public_reports to authenticated;

grant select on public.public_report_photos to authenticated;

drop policy if exists public_reports_select_owner on public.public_reports;
create policy public_reports_select_owner
on public.public_reports for select to authenticated
using (private.is_owner(organization_id));

drop policy if exists public_report_photos_select_owner on public.public_report_photos;
create policy public_report_photos_select_owner
on public.public_report_photos for select to authenticated
using (private.is_owner(organization_id));

-- Called only by the application server (service role), which supplies the
-- reporter fingerprint. Anonymous and signed-in API callers cannot run it,
-- so the rate limit cannot be bypassed with an invented fingerprint.
create or replace function public.submit_public_report(
  p_public_report_code uuid,
  p_request_id uuid,
  p_description text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_description text := btrim(coalesce(p_description, ''));
  v_equipment_id uuid;
  v_organization_id uuid;
  v_report_id uuid;
  v_token_bytes bytea := extensions.gen_random_bytes(32);
  v_token_hash bytea;
  v_upload_expires_at timestamptz := now() + interval '15 minutes';
begin
  v_token_hash := extensions.digest(v_token_bytes, 'sha256');

  if p_request_id is null then
    raise exception using errcode = '22023', message = 'Request ID is required.';
  end if;

  if char_length(v_description) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'Invalid description.';
  end if;

  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid fingerprint.';
  end if;

  select equipment.id, equipment.organization_id
  into v_equipment_id, v_organization_id
  from public.equipment as equipment
  where equipment.public_report_code = p_public_report_code
    and equipment.public_reporting_enabled
    and equipment.archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Reporting code not found.';
  end if;

  -- One device's submissions are checked one at a time.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_fingerprint, 2)
  );

  -- A retry of the same submission returns the same report with a new
  -- upload token (the first one may never have reached the visitor).
  update public.public_reports as report
  set upload_token_hash = v_token_hash,
      upload_expires_at = v_upload_expires_at
  where report.equipment_id = v_equipment_id
    and report.client_request_id = p_request_id
    and report.reporter_fingerprint = p_fingerprint
  returning report.id into v_report_id;

  if v_report_id is null then
    if exists (
      select 1
      from public.public_reports as report
      where report.equipment_id = v_equipment_id
        and report.client_request_id = p_request_id
    ) then
      raise exception using errcode = '22023', message = 'Request ID already used.';
    end if;

    if (
      select count(*)
      from public.public_reports as report
      where report.reporter_fingerprint = p_fingerprint
        and report.created_at > now() - interval '10 minutes'
    ) >= 5 then
      raise exception using errcode = 'RL020', message = 'Too many reports.';
    end if;

    if (
      select count(*)
      from public.public_reports as report
      where report.equipment_id = v_equipment_id
        and report.created_at > now() - interval '1 hour'
    ) >= 20 then
      raise exception using errcode = 'RL020', message = 'Too many reports.';
    end if;

    if (
      select count(*)
      from public.public_reports as report
      where report.organization_id = v_organization_id
        and report.status = 'pending'
    ) >= 200 then
      raise exception using errcode = 'RL021', message = 'Review inbox is full.';
    end if;

    insert into public.public_reports (
      organization_id,
      equipment_id,
      client_request_id,
      description,
      reporter_fingerprint,
      upload_token_hash,
      upload_expires_at
    )
    values (
      v_organization_id,
      v_equipment_id,
      p_request_id,
      v_description,
      p_fingerprint,
      v_token_hash,
      v_upload_expires_at
    )
    returning id into v_report_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'report_id', v_report_id,
    'organization_id', v_organization_id,
    'upload_token', pg_catalog.encode(v_token_bytes, 'hex')
  );
end;
$$;

create or replace function public.accept_public_report(
  p_organization_id uuid,
  p_report_id uuid,
  p_priority text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_priority text := lower(btrim(coalesce(p_priority, '')));
  v_report public.public_reports%rowtype;
  v_category text;
  v_ticket_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if v_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception using errcode = '22023', message = 'Invalid priority.';
  end if;

  -- Lock the report so two reviews cannot both create a ticket.
  select report.*
  into v_report
  from public.public_reports as report
  where report.organization_id = p_organization_id
    and report.id = p_report_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Report not found.';
  end if;

  if v_report.status = 'accepted' then
    return v_report.accepted_ticket_id;
  end if;

  if v_report.status = 'dismissed' then
    raise exception using errcode = 'RL022', message = 'Report already dismissed.';
  end if;

  select equipment.category
  into v_category
  from public.equipment as equipment
  where equipment.organization_id = p_organization_id
    and equipment.id = v_report.equipment_id;

  -- The report ID doubles as the ticket's idempotency key.
  insert into public.tickets (
    organization_id,
    equipment_id,
    reporter_id,
    client_request_id,
    category,
    priority,
    status,
    description
  )
  values (
    p_organization_id,
    v_report.equipment_id,
    v_actor_id,
    v_report.id,
    v_category,
    v_priority,
    'open',
    v_report.description
  )
  on conflict (organization_id, reporter_id, client_request_id) do nothing
  returning id into v_ticket_id;

  if v_ticket_id is null then
    select ticket.id
    into v_ticket_id
    from public.tickets as ticket
    where ticket.organization_id = p_organization_id
      and ticket.reporter_id = v_actor_id
      and ticket.client_request_id = v_report.id;
  end if;

  insert into public.attachments (
    organization_id,
    ticket_id,
    uploaded_by,
    photo_slot,
    storage_path,
    size_bytes,
    media_type,
    width,
    height,
    upload_state
  )
  select
    photo.organization_id,
    v_ticket_id,
    v_actor_id,
    photo.photo_slot,
    photo.storage_path,
    photo.size_bytes,
    photo.media_type,
    photo.width,
    photo.height,
    'ready'
  from public.public_report_photos as photo
  where photo.organization_id = p_organization_id
    and photo.report_id = v_report.id
  on conflict do nothing;

  update public.public_reports as report
  set status = 'accepted',
      accepted_ticket_id = v_ticket_id,
      reviewed_by = v_actor_id,
      reviewed_at = now()
  where report.id = v_report.id;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  values (
    p_organization_id,
    v_actor_id,
    'public_report.accepted',
    'public_report',
    v_report.id,
    pg_catalog.jsonb_build_object('ticket_id', v_ticket_id)
  );

  return v_ticket_id;
end;
$$;

create or replace function public.dismiss_public_report(
  p_organization_id uuid,
  p_report_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_status text;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  select report.status
  into v_status
  from public.public_reports as report
  where report.organization_id = p_organization_id
    and report.id = p_report_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Report not found.';
  end if;

  if v_status = 'dismissed' then
    return;
  end if;

  if v_status = 'accepted' then
    raise exception using errcode = 'RL023', message = 'Report already accepted.';
  end if;

  update public.public_reports as report
  set status = 'dismissed',
      reviewed_by = v_actor_id,
      reviewed_at = now()
  where report.organization_id = p_organization_id
    and report.id = p_report_id;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id,
    v_actor_id,
    'public_report.dismissed',
    'public_report',
    p_report_id
  );
end;
$$;

revoke all on function public.submit_public_report(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.accept_public_report(uuid, uuid, text)
  from public, anon;
revoke all on function public.dismiss_public_report(uuid, uuid)
  from public, anon;

grant execute on function public.submit_public_report(uuid, uuid, text, text)
  to service_role;
grant execute on function public.accept_public_report(uuid, uuid, text)
  to authenticated;
grant execute on function public.dismiss_public_report(uuid, uuid)
  to authenticated;

-- The application server writes reports and photo records with the service
-- role only.
grant select, insert, update on public.public_reports to service_role;
grant select, insert on public.public_report_photos to service_role;

notify pgrst, 'reload schema';

commit;
