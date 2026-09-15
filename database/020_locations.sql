begin;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_tenant_key unique (organization_id, id),
  constraint locations_one_per_organization unique (organization_id),
  constraint locations_name_per_organization unique (organization_id, name)
);

create index locations_organization_idx
  on public.locations (organization_id, created_at, id);

create trigger locations_set_updated_at
before update on public.locations
for each row execute function private.set_updated_at();

commit;
