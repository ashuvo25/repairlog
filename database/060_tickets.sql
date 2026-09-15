begin;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  equipment_id uuid not null,
  reporter_id uuid not null,
  client_request_id uuid not null,
  category text not null check (char_length(category) between 1 and 80),
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'awaiting_verification', 'resolved')),
  description text not null check (char_length(description) between 1 and 4000),
  version integer not null default 1 check (version > 0),
  resolved_at timestamptz,
  resolved_by uuid,
  reopened_reason text check (
    reopened_reason is null or char_length(reopened_reason) between 1 and 1000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_tenant_key unique (organization_id, id),
  constraint tickets_idempotency_key
    unique (organization_id, reporter_id, client_request_id),
  constraint tickets_equipment_fk
    foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id),
  constraint tickets_reporter_membership_fk
    foreign key (organization_id, reporter_id)
    references public.memberships (organization_id, user_id),
  constraint tickets_resolver_membership_fk
    foreign key (organization_id, resolved_by)
    references public.memberships (organization_id, user_id),
  constraint tickets_resolution_consistency check (
    (status = 'resolved' and resolved_at is not null and resolved_by is not null)
    or (status <> 'resolved' and resolved_at is null and resolved_by is null)
  )
);

create index tickets_organization_status_updated_idx
  on public.tickets (organization_id, status, updated_at desc, id);

create index tickets_organization_equipment_created_idx
  on public.tickets (organization_id, equipment_id, created_at desc);

create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function private.set_updated_at();

commit;

