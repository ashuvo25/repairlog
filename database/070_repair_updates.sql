begin;

create table public.repair_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ticket_id uuid not null,
  author_id uuid not null,
  technician_name text check (
    technician_name is null or char_length(technician_name) between 1 and 120
  ),
  work_note text not null check (char_length(work_note) between 1 and 4000),
  -- The application derives this date from the organization's timezone.
  work_date date not null,
  created_at timestamptz not null default now(),
  constraint repair_updates_tenant_key unique (organization_id, id),
  constraint repair_updates_ticket_fk
    foreign key (organization_id, ticket_id)
    references public.tickets (organization_id, id),
  constraint repair_updates_author_membership_fk
    foreign key (organization_id, author_id)
    references public.memberships (organization_id, user_id)
);

create index repair_updates_organization_ticket_created_idx
  on public.repair_updates (organization_id, ticket_id, created_at desc);

commit;
