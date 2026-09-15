begin;

create table public.menu_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  menu_item_id uuid not null,
  equipment_id uuid not null,
  created_at timestamptz not null default now(),
  constraint menu_dependencies_tenant_key unique (organization_id, id),
  constraint menu_dependencies_pair_key
    unique (organization_id, menu_item_id, equipment_id),
  constraint menu_dependencies_menu_item_fk
    foreign key (organization_id, menu_item_id)
    references public.menu_items (organization_id, id),
  constraint menu_dependencies_equipment_fk
    foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id)
);

create index menu_dependencies_organization_equipment_idx
  on public.menu_dependencies (organization_id, equipment_id, menu_item_id);

create index menu_dependencies_organization_menu_item_idx
  on public.menu_dependencies (organization_id, menu_item_id, equipment_id);

commit;

