begin;

create or replace function private.bump_record_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists equipment_bump_record_version on public.equipment;
create trigger equipment_bump_record_version
before update on public.equipment
for each row execute function private.bump_record_version();

drop trigger if exists tickets_bump_record_version on public.tickets;
create trigger tickets_bump_record_version
before update on public.tickets
for each row execute function private.bump_record_version();

create or replace function private.enforce_organization_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_currency text;
begin
  select organization.currency
  into organization_currency
  from public.organizations as organization
  where organization.id = new.organization_id;

  if organization_currency is null or new.currency <> organization_currency then
    raise exception using
      errcode = '23514',
      message = 'Repair cost currency must match the organization currency.';
  end if;

  return new;
end;
$$;

drop trigger if exists repair_costs_enforce_organization_currency
  on public.repair_costs;
create trigger repair_costs_enforce_organization_currency
before insert or update of organization_id, currency on public.repair_costs
for each row execute function private.enforce_organization_currency();

create or replace function private.protect_last_active_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_owner_count integer;
begin
  if old.role <> 'owner' or old.state <> 'active' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' and new.state = 'active' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(old.organization_id::text, 0)
  );

  select count(*)
  into remaining_owner_count
  from public.memberships as membership
  where membership.organization_id = old.organization_id
    and membership.role = 'owner'
    and membership.state = 'active'
    and membership.id <> old.id;

  if remaining_owner_count = 0 then
    raise exception using
      errcode = '23514',
      message = 'An organization must retain at least one active owner.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists memberships_protect_last_active_owner
  on public.memberships;
create trigger memberships_protect_last_active_owner
before update of role, state or delete on public.memberships
for each row execute function private.protect_last_active_owner();

revoke all on function private.bump_record_version() from public;
revoke all on function private.enforce_organization_currency() from public;
revoke all on function private.protect_last_active_owner() from public;

commit;
