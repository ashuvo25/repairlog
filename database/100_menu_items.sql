begin;

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 1 and 120),
  approved_alternative text check (
    approved_alternative is null
    or char_length(approved_alternative) between 1 and 1000
  ),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_tenant_key unique (organization_id, id),
  constraint menu_items_name_per_organization unique (organization_id, name)
);

create index menu_items_organization_archive_idx
  on public.menu_items (organization_id, archived_at, name, id);

create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function private.set_updated_at();

commit;

