begin;

create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  billing_subscription_id uuid,
  provider_environment text not null check (provider_environment in ('test', 'live')),
  provider_store_id text not null check (char_length(provider_store_id) between 1 and 120),
  provider_invoice_id text not null check (char_length(provider_invoice_id) between 1 and 120),
  status text not null check (char_length(status) between 1 and 80),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  issued_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  provider_updated_at timestamptz not null,
  synced_at timestamptz not null,
  raw_provider_fields jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_provider_fields) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_invoices_tenant_key unique (organization_id, id),
  constraint billing_invoices_provider_key unique (
    provider_environment, provider_store_id, provider_invoice_id
  ),
  constraint billing_invoices_subscription_fk
    foreign key (organization_id, billing_subscription_id)
    references public.billing_subscriptions (organization_id, id)
);

create index billing_invoices_organization_issued_idx
  on public.billing_invoices (organization_id, issued_at desc, id);

create trigger billing_invoices_set_updated_at
before update on public.billing_invoices
for each row execute function private.set_updated_at();

commit;

