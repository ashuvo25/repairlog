begin;

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  provider_environment text not null check (provider_environment in ('test', 'live')),
  provider_store_id text not null check (char_length(provider_store_id) between 1 and 120),
  event_type text not null check (char_length(event_type) between 1 and 120),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id text not null check (char_length(resource_id) between 1 and 120),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  signature_verified_at timestamptz not null,
  processing_state text not null default 'pending'
    check (processing_state in ('pending', 'processing', 'processed', 'failed', 'ignored')),
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  processed_at timestamptz,
  last_error text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_events_deduplication_key unique (
    provider_environment,
    provider_store_id,
    event_type,
    resource_type,
    resource_id,
    payload_hash
  )
);

create index billing_events_processing_idx
  on public.billing_events (processing_state, received_at, id)
  where processing_state in ('pending', 'failed');

create index billing_events_organization_received_idx
  on public.billing_events (organization_id, received_at desc, id);

create trigger billing_events_set_updated_at
before update on public.billing_events
for each row execute function private.set_updated_at();

commit;

