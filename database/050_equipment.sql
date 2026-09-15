begin;

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  location_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (char_length(category) between 1 and 80),
  condition text not null default 'unknown'
    check (condition in ('operational', 'unavailable', 'unknown')),
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_tenant_key unique (organization_id, id),
  constraint equipment_location_fk
    foreign key (organization_id, location_id)
    references public.locations (organization_id, id)
);

create index equipment_organization_location_archive_idx
  on public.equipment (organization_id, location_id, archived_at, id);

create trigger equipment_set_updated_at
before update on public.equipment
for each row execute function private.set_updated_at();

commit;

