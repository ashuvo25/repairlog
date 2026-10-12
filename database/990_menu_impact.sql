begin;

-- Menu impact: owners link menu items to the machines needed to make them.
-- Item status is derived from verified equipment condition at read time:
--   every linked machine operational -> Available
--   any linked machine unavailable   -> Affected
--   otherwise                        -> Unknown
--   no linked machines               -> Not configured
--
-- Custom SQLSTATE codes:
--   RL040 a menu item with this name already exists
--   RL041 a linked machine is not active equipment of this café

-- Changes are checked against the updated_at the owner last saw, so two
-- people editing the same item get a conflict instead of a silent overwrite.

create or replace function private.replace_menu_dependencies(
  p_organization_id uuid,
  p_menu_item_id uuid,
  p_equipment_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_equipment_ids uuid[] := coalesce(
    (select array_agg(distinct linked_id) from unnest(p_equipment_ids) as linked_id),
    '{}'::uuid[]
  );
begin
  if pg_catalog.cardinality(v_equipment_ids) > 50 then
    raise exception using errcode = '22023', message = 'Too many linked machines.';
  end if;

  if exists (
    select 1
    from unnest(v_equipment_ids) as linked_id
    where not exists (
      select 1
      from public.equipment as equipment
      where equipment.organization_id = p_organization_id
        and equipment.id = linked_id
        and equipment.archived_at is null
    )
  ) then
    raise exception using errcode = 'RL041', message = 'Linked equipment not found.';
  end if;

  delete from public.menu_dependencies as dependency
  where dependency.organization_id = p_organization_id
    and dependency.menu_item_id = p_menu_item_id
    and not (dependency.equipment_id = any (v_equipment_ids));

  insert into public.menu_dependencies (organization_id, menu_item_id, equipment_id)
  select p_organization_id, p_menu_item_id, linked_id
  from unnest(v_equipment_ids) as linked_id
  on conflict (organization_id, menu_item_id, equipment_id) do nothing;
end;
$$;

revoke all on function private.replace_menu_dependencies(uuid, uuid, uuid[])
  from public;

create or replace function public.save_menu_item(
  p_organization_id uuid,
  p_menu_item_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_alternative text,
  p_equipment_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_alternative text := nullif(btrim(coalesce(p_alternative, '')), '');
  v_menu_item_id uuid;
  v_current_updated_at timestamptz;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid menu item name.';
  end if;

  if v_alternative is not null and char_length(v_alternative) > 1000 then
    raise exception using errcode = '22023', message = 'Invalid alternative.';
  end if;

  if exists (
    select 1
    from public.menu_items as item
    where item.organization_id = p_organization_id
      and lower(item.name) = lower(v_name)
      and item.archived_at is null
      and item.id is distinct from p_menu_item_id
  ) then
    raise exception using errcode = 'RL040', message = 'Menu item name already used.';
  end if;

  if p_menu_item_id is null then
    insert into public.menu_items (organization_id, name, approved_alternative)
    values (p_organization_id, v_name, v_alternative)
    returning id into v_menu_item_id;
  else
    select item.updated_at
    into v_current_updated_at
    from public.menu_items as item
    where item.organization_id = p_organization_id
      and item.id = p_menu_item_id
      and item.archived_at is null
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'Menu item not found.';
    end if;

    if p_expected_updated_at is null or v_current_updated_at <> p_expected_updated_at then
      raise exception using errcode = '40001', message = 'Menu item changed. Refresh and try again.';
    end if;

    update public.menu_items as item
    set name = v_name,
        approved_alternative = v_alternative,
        updated_at = now()
    where item.id = p_menu_item_id;

    v_menu_item_id := p_menu_item_id;
  end if;

  perform private.replace_menu_dependencies(
    p_organization_id, v_menu_item_id, p_equipment_ids
  );

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id,
    v_actor_id,
    case when p_menu_item_id is null then 'menu_item.created' else 'menu_item.updated' end,
    'menu_item',
    v_menu_item_id
  );

  return v_menu_item_id;
end;
$$;

create or replace function public.archive_menu_item(
  p_organization_id uuid,
  p_menu_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_archived_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  update public.menu_items as item
  set archived_at = now()
  where item.organization_id = p_organization_id
    and item.id = p_menu_item_id
    and item.archived_at is null
  returning item.id into v_archived_id;

  if v_archived_id is null then
    raise exception using errcode = 'P0002', message = 'Menu item not found.';
  end if;

  delete from public.menu_dependencies as dependency
  where dependency.organization_id = p_organization_id
    and dependency.menu_item_id = p_menu_item_id;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id, v_actor_id, 'menu_item.archived', 'menu_item', p_menu_item_id
  );
end;
$$;

revoke all on function public.save_menu_item(uuid, uuid, timestamptz, text, text, uuid[])
  from public, anon;
revoke all on function public.archive_menu_item(uuid, uuid)
  from public, anon;

grant execute on function public.save_menu_item(uuid, uuid, timestamptz, text, text, uuid[])
  to authenticated;
grant execute on function public.archive_menu_item(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
