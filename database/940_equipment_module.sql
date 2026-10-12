begin;

alter table public.equipment
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists creation_request_id uuid,
  add column if not exists public_report_code uuid,
  add column if not exists public_reporting_enabled boolean not null default true;

update public.equipment
set public_report_code = extensions.gen_random_uuid()
where public_report_code is null;

update public.equipment
set public_reporting_enabled = false
where archived_at is not null
  and public_reporting_enabled;

alter table public.equipment
  alter column public_report_code set default extensions.gen_random_uuid(),
  alter column public_report_code set not null;

create unique index if not exists equipment_public_report_code_idx
  on public.equipment (public_report_code);

create unique index if not exists equipment_creation_request_idx
  on public.equipment (organization_id, created_by, creation_request_id)
  where created_by is not null and creation_request_id is not null;

create or replace function public.create_equipment(
  p_organization_id uuid,
  p_request_id uuid,
  p_name text,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_equipment_id uuid;
  v_location_id uuid;
  v_name text := btrim(p_name);
  v_category text := btrim(p_category);
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if p_request_id is null then
    raise exception using errcode = '22023', message = 'Request ID is required.';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid equipment name.';
  end if;

  if char_length(v_category) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Invalid equipment category.';
  end if;

  select equipment.id
  into v_equipment_id
  from public.equipment as equipment
  where equipment.organization_id = p_organization_id
    and equipment.created_by = v_actor_id
    and equipment.creation_request_id = p_request_id;

  if v_equipment_id is not null then
    return v_equipment_id;
  end if;

  select location.id
  into v_location_id
  from public.locations as location
  where location.organization_id = p_organization_id
  order by location.created_at, location.id
  limit 1;

  if v_location_id is null then
    raise exception using errcode = 'P0002', message = 'Organization location not found.';
  end if;

  insert into public.equipment (
    organization_id,
    location_id,
    name,
    category,
    condition,
    created_by,
    creation_request_id,
    public_report_code,
    public_reporting_enabled
  )
  values (
    p_organization_id,
    v_location_id,
    v_name,
    v_category,
    'unknown',
    v_actor_id,
    p_request_id,
    extensions.gen_random_uuid(),
    true
  )
  on conflict (organization_id, created_by, creation_request_id)
    where created_by is not null and creation_request_id is not null
  do nothing
  returning id into v_equipment_id;

  if v_equipment_id is null then
    select equipment.id
    into v_equipment_id
    from public.equipment as equipment
    where equipment.organization_id = p_organization_id
      and equipment.created_by = v_actor_id
      and equipment.creation_request_id = p_request_id;
  end if;

  if v_equipment_id is null then
    raise exception using errcode = 'P0001', message = 'Equipment creation failed.';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    request_id
  )
  values (
    p_organization_id,
    v_actor_id,
    'equipment.created',
    'equipment',
    v_equipment_id,
    p_request_id
  );

  return v_equipment_id;
end;
$$;

create or replace function public.update_equipment(
  p_organization_id uuid,
  p_equipment_id uuid,
  p_expected_version integer,
  p_name text,
  p_category text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_new_version integer;
  v_name text := btrim(p_name);
  v_category text := btrim(p_category);
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'Invalid equipment version.';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid equipment name.';
  end if;

  if char_length(v_category) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Invalid equipment category.';
  end if;

  update public.equipment as equipment
  set name = v_name,
      category = v_category
  where equipment.organization_id = p_organization_id
    and equipment.id = p_equipment_id
    and equipment.version = p_expected_version
    and equipment.archived_at is null
  returning equipment.version into v_new_version;

  if v_new_version is null then
    if exists (
      select 1
      from public.equipment as equipment
      where equipment.organization_id = p_organization_id
        and equipment.id = p_equipment_id
        and equipment.archived_at is null
    ) then
      raise exception using errcode = '40001', message = 'Equipment changed. Refresh and try again.';
    end if;

    raise exception using errcode = 'P0002', message = 'Active equipment not found.';
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id,
    v_actor_id,
    'equipment.updated',
    'equipment',
    p_equipment_id
  );

  return v_new_version;
end;
$$;

create or replace function public.set_equipment_condition(
  p_organization_id uuid,
  p_equipment_id uuid,
  p_expected_version integer,
  p_condition text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_condition text := lower(btrim(p_condition));
  v_new_version integer;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'Invalid equipment version.';
  end if;

  if v_condition not in ('operational', 'unavailable', 'unknown') then
    raise exception using errcode = '22023', message = 'Invalid equipment condition.';
  end if;

  update public.equipment as equipment
  set condition = v_condition
  where equipment.organization_id = p_organization_id
    and equipment.id = p_equipment_id
    and equipment.version = p_expected_version
    and equipment.archived_at is null
  returning equipment.version into v_new_version;

  if v_new_version is null then
    if exists (
      select 1
      from public.equipment as equipment
      where equipment.organization_id = p_organization_id
        and equipment.id = p_equipment_id
        and equipment.archived_at is null
    ) then
      raise exception using errcode = '40001', message = 'Equipment changed. Refresh and try again.';
    end if;

    raise exception using errcode = 'P0002', message = 'Active equipment not found.';
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  values (
    p_organization_id,
    v_actor_id,
    'equipment.condition_changed',
    'equipment',
    p_equipment_id,
    pg_catalog.jsonb_build_object('condition', v_condition)
  );

  return v_new_version;
end;
$$;

create or replace function public.archive_equipment(
  p_organization_id uuid,
  p_equipment_id uuid,
  p_expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_new_version integer;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'Invalid equipment version.';
  end if;

  update public.equipment as equipment
  set archived_at = pg_catalog.now(),
      public_reporting_enabled = false
  where equipment.organization_id = p_organization_id
    and equipment.id = p_equipment_id
    and equipment.version = p_expected_version
    and equipment.archived_at is null
  returning equipment.version into v_new_version;

  if v_new_version is null then
    if exists (
      select 1
      from public.equipment as equipment
      where equipment.organization_id = p_organization_id
        and equipment.id = p_equipment_id
        and equipment.archived_at is null
    ) then
      raise exception using errcode = '40001', message = 'Equipment changed. Refresh and try again.';
    end if;

    raise exception using errcode = 'P0002', message = 'Active equipment not found.';
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id,
    v_actor_id,
    'equipment.archived',
    'equipment',
    p_equipment_id
  );

  return v_new_version;
end;
$$;

create or replace function public.rotate_equipment_public_code(
  p_organization_id uuid,
  p_equipment_id uuid,
  p_expected_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_public_report_code uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'Invalid equipment version.';
  end if;

  update public.equipment as equipment
  set public_report_code = extensions.gen_random_uuid(),
      public_reporting_enabled = true
  where equipment.organization_id = p_organization_id
    and equipment.id = p_equipment_id
    and equipment.version = p_expected_version
    and equipment.archived_at is null
  returning equipment.public_report_code into v_public_report_code;

  if v_public_report_code is null then
    if exists (
      select 1
      from public.equipment as equipment
      where equipment.organization_id = p_organization_id
        and equipment.id = p_equipment_id
        and equipment.archived_at is null
    ) then
      raise exception using errcode = '40001', message = 'Equipment changed. Refresh and try again.';
    end if;

    raise exception using errcode = 'P0002', message = 'Active equipment not found.';
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id,
    v_actor_id,
    'equipment.public_code_rotated',
    'equipment',
    p_equipment_id
  );

  return v_public_report_code;
end;
$$;

create or replace function public.get_public_equipment_context(
  p_public_report_code uuid
)
returns table (
  cafe_name text,
  equipment_name text,
  equipment_category text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    organization.name as cafe_name,
    equipment.name as equipment_name,
    equipment.category as equipment_category
  from public.equipment as equipment
  join public.organizations as organization
    on organization.id = equipment.organization_id
  where equipment.public_report_code = p_public_report_code
    and equipment.public_reporting_enabled
    and equipment.archived_at is null
  limit 1;
$$;

revoke all on function public.create_equipment(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.update_equipment(uuid, uuid, integer, text, text)
  from public, anon;
revoke all on function public.set_equipment_condition(uuid, uuid, integer, text)
  from public, anon;
revoke all on function public.archive_equipment(uuid, uuid, integer)
  from public, anon;
revoke all on function public.rotate_equipment_public_code(uuid, uuid, integer)
  from public, anon;
revoke all on function public.get_public_equipment_context(uuid)
  from public;

grant execute on function public.create_equipment(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.update_equipment(uuid, uuid, integer, text, text)
  to authenticated;
grant execute on function public.set_equipment_condition(uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.archive_equipment(uuid, uuid, integer)
  to authenticated;
grant execute on function public.rotate_equipment_public_code(uuid, uuid, integer)
  to authenticated;
grant execute on function public.get_public_equipment_context(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
