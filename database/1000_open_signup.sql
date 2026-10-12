begin;

-- Open sign-up with a free trial. Replaces the pilot allowlist from
-- 960_pilot_owner_access.sql: any verified Google account that is not already
-- in a café can create one. The 15-day trial is measured from the café's
-- created_at in the application. The pilot_owner_emails table is kept but no
-- longer consulted.
--   RL010 the user already belongs to a café

create or replace function public.can_create_organization()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.current_verified_email() is not null
    and not exists (
      select 1
      from public.memberships as membership
      where membership.user_id = auth.uid()
        and membership.state = 'active'
    );
$$;

create or replace function public.create_organization(
  p_request_id uuid,
  p_name text,
  p_currency text,
  p_timezone text,
  p_location_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  created_organization_id uuid;
  normalized_name text := btrim(p_name);
  normalized_location_name text := btrim(p_location_name);
  normalized_currency text := upper(btrim(p_currency));
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if private.current_verified_email() is null then
    raise exception using errcode = '42501', message = 'A verified email is required.';
  end if;

  if p_request_id is null then
    raise exception using errcode = '22023', message = 'Request ID is required.';
  end if;

  if char_length(normalized_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid organization name.';
  end if;

  if char_length(normalized_location_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid location name.';
  end if;

  if normalized_currency !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'Invalid currency code.';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception using errcode = '22023', message = 'Invalid timezone.';
  end if;

  select organization.id
  into created_organization_id
  from public.organizations as organization
  where organization.created_by = v_actor_id
    and organization.creation_request_id = p_request_id;

  if created_organization_id is not null then
    return created_organization_id;
  end if;

  if exists (
    select 1
    from public.memberships as membership
    where membership.user_id = v_actor_id
      and membership.state = 'active'
  ) then
    raise exception using errcode = 'RL010', message = 'Already a member of an organization.';
  end if;

  insert into public.organizations (
    name,
    currency,
    timezone,
    created_by,
    creation_request_id
  )
  values (
    normalized_name,
    normalized_currency,
    p_timezone,
    v_actor_id,
    p_request_id
  )
  on conflict (created_by, creation_request_id)
    where creation_request_id is not null
  do nothing
  returning id into created_organization_id;

  if created_organization_id is null then
    select organization.id
    into created_organization_id
    from public.organizations as organization
    where organization.created_by = v_actor_id
      and organization.creation_request_id = p_request_id;
  end if;

  if not exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = created_organization_id
      and membership.user_id = v_actor_id
  ) then
    insert into public.locations (organization_id, name)
    values (created_organization_id, normalized_location_name);

    insert into public.memberships (organization_id, user_id, role, state)
    values (created_organization_id, v_actor_id, 'owner', 'active');

    insert into public.audit_events (
      organization_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      request_id
    )
    values (
      created_organization_id,
      v_actor_id,
      'organization.created',
      'organization',
      created_organization_id,
      p_request_id
    );
  end if;

  return created_organization_id;
end;
$$;

revoke all on function public.can_create_organization() from public, anon;
grant execute on function public.can_create_organization() to authenticated;

revoke all on function public.create_organization(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.create_organization(uuid, text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
