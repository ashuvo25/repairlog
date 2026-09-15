begin;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'staff')),
  state text not null default 'active' check (state in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_tenant_key unique (organization_id, id),
  constraint memberships_user_tenant_key unique (organization_id, user_id),
  constraint memberships_removal_consistency check (
    (state = 'active' and removed_at is null)
    or (state = 'removed' and removed_at is not null)
  )
);

create index memberships_user_organization_idx
  on public.memberships (user_id, organization_id);

create index memberships_active_owners_idx
  on public.memberships (organization_id, user_id)
  where role = 'owner' and state = 'active';

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function private.set_updated_at();

commit;

