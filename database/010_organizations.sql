begin;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  timezone text not null check (char_length(timezone) between 1 and 100),
  onboarding_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(onboarding_state) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_tenant_key unique (id)
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

commit;

