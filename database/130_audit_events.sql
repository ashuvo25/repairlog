begin;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id),
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  request_id uuid,
  occurred_at timestamptz not null default now(),
  constraint audit_events_tenant_key unique (organization_id, id)
);

create index audit_events_organization_occurred_idx
  on public.audit_events (organization_id, occurred_at desc, id);

create index audit_events_entity_idx
  on public.audit_events (organization_id, entity_type, entity_id, occurred_at desc);

commit;

