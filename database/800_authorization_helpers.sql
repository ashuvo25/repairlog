begin;

create or replace function private.is_active_member(
  target_organization_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = target_user_id
      and membership.state = 'active'
  );
$$;

create or replace function private.is_owner(
  target_organization_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = target_user_id
      and membership.role = 'owner'
      and membership.state = 'active'
  );
$$;

revoke all on function private.is_active_member(uuid, uuid) from public;
revoke all on function private.is_owner(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid, uuid) to authenticated;
grant execute on function private.is_owner(uuid, uuid) to authenticated;

commit;

