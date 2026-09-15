begin;

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  checkout_attempt_id uuid,
  provider_environment text not null check (provider_environment in ('test', 'live')),
  provider_store_id text not null check (char_length(provider_store_id) between 1 and 120),
  provider_subscription_id text not null check (
    char_length(provider_subscription_id) between 1 and 120
  ),
  provider_customer_id text not null check (char_length(provider_customer_id) between 1 and 120),
  provider_order_id text,
  provider_product_id text not null check (char_length(provider_product_id) between 1 and 120),
  provider_variant_id text not null check (char_length(provider_variant_id) between 1 and 120),
  status text not null check (
    status in ('on_trial', 'active', 'cancelled', 'past_due', 'unpaid', 'expired', 'paused')
  ),
  provider_created_at timestamptz not null,
  trial_ends_at timestamptz,
  renews_at timestamptz,
  ends_at timestamptz,
  cancelled_at timestamptz,
  paused_at timestamptz,
  provider_updated_at timestamptz not null,
  synced_at timestamptz not null,
  raw_provider_fields jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_provider_fields) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_tenant_key unique (organization_id, id),
  constraint billing_subscriptions_provider_key unique (
    provider_environment, provider_store_id, provider_subscription_id
  ),
  constraint billing_subscriptions_checkout_fk
    foreign key (organization_id, checkout_attempt_id)
    references public.billing_checkout_attempts (organization_id, id)
);

create index billing_subscriptions_organization_sync_idx
  on public.billing_subscriptions (organization_id, synced_at desc, id);

create index billing_subscriptions_reconciliation_idx
  on public.billing_subscriptions (synced_at, provider_environment, id);

create trigger billing_subscriptions_set_updated_at
before update on public.billing_subscriptions
for each row execute function private.set_updated_at();

commit;

