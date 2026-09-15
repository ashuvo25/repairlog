begin;

create table public.billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null,
  binding_token_hash bytea not null,
  provider_store_id text not null check (char_length(provider_store_id) between 1 and 120),
  provider_variant_id text not null check (char_length(provider_variant_id) between 1 and 120),
  provider_environment text not null check (provider_environment in ('test', 'live')),
  provider_checkout_id text,
  status text not null default 'created'
    check (status in ('created', 'redirected', 'matched', 'expired', 'failed')),
  expires_at timestamptz not null,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_checkout_attempts_tenant_key unique (organization_id, id),
  constraint billing_checkout_attempts_binding_key unique (binding_token_hash),
  constraint billing_checkout_attempts_creator_membership_fk
    foreign key (organization_id, created_by)
    references public.memberships (organization_id, user_id),
  constraint billing_checkout_attempts_match_consistency check (
    (status = 'matched' and matched_at is not null)
    or (status <> 'matched' and matched_at is null)
  )
);

create index billing_checkout_attempts_organization_created_idx
  on public.billing_checkout_attempts (organization_id, created_at desc);

create index billing_checkout_attempts_expiry_idx
  on public.billing_checkout_attempts (status, expires_at)
  where status in ('created', 'redirected');

create trigger billing_checkout_attempts_set_updated_at
before update on public.billing_checkout_attempts
for each row execute function private.set_updated_at();

commit;

