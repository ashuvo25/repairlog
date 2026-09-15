begin;

create table public.repair_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  ticket_id uuid not null,
  recorded_by uuid not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  recorded_date date not null,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repair_costs_tenant_key unique (organization_id, id),
  constraint repair_costs_ticket_fk
    foreign key (organization_id, ticket_id)
    references public.tickets (organization_id, id),
  constraint repair_costs_recorder_membership_fk
    foreign key (organization_id, recorded_by)
    references public.memberships (organization_id, user_id)
);

create index repair_costs_organization_recorded_date_idx
  on public.repair_costs (organization_id, recorded_date desc, id);

create index repair_costs_organization_ticket_idx
  on public.repair_costs (organization_id, ticket_id, created_at desc);

create trigger repair_costs_set_updated_at
before update on public.repair_costs
for each row execute function private.set_updated_at();

commit;

