begin;

-- Team module: owner-issued staff invitations, acceptance by the invited
-- Google account, staff removal, and owner-only organization settings.
--
-- Invitation tokens are 32 random bytes. Only the SHA-256 hash is stored, so
-- a database read never reveals a usable invitation link.
--
-- Custom SQLSTATE codes (mapped to user-facing copy in the application):
--   RL001 already an active member      RL005 invitation expired
--   RL002 team is full                  RL006 signed-in email does not match
--   RL003 invitation already used       RL007 user belongs to another café
--   RL004 invitation revoked            RL008 owners cannot remove themselves

create or replace function private.current_verified_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(current_user_row.email::text))
  from auth.users as current_user_row
  where current_user_row.id = auth.uid()
    and current_user_row.email is not null
    and current_user_row.email_confirmed_at is not null;
$$;

create or replace function private.invitation_token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select case
    when p_token ~ '^[0-9a-f]{64}$'
      then extensions.digest(pg_catalog.decode(p_token, 'hex'), 'sha256')
    else null
  end;
$$;

revoke all on function private.current_verified_email() from public;
revoke all on function private.invitation_token_hash(text) from public;

create or replace function public.create_invitation(
  p_organization_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token_bytes bytea := extensions.gen_random_bytes(32);
  v_expires_at timestamptz := now() + interval '7 days';
  v_invitation_id uuid;
  v_seats_in_use integer;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if char_length(v_email) not between 3 and 320
    or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception using errcode = '22023', message = 'Invalid email address.';
  end if;

  -- Serialize invitation changes per organization so the seat count holds.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text, 1)
  );

  if exists (
    select 1
    from public.memberships as membership
    join auth.users as member_user
      on member_user.id = membership.user_id
    where membership.organization_id = p_organization_id
      and membership.state = 'active'
      and lower(member_user.email::text) = v_email
  ) then
    raise exception using errcode = 'RL001', message = 'Already an active member.';
  end if;

  -- A new invitation replaces any earlier pending one for the same address.
  update public.invitations as invitation
  set revoked_at = now()
  where invitation.organization_id = p_organization_id
    and invitation.intended_email = v_email
    and invitation.accepted_at is null
    and invitation.revoked_at is null;

  select
    (
      select count(*)
      from public.memberships as membership
      where membership.organization_id = p_organization_id
        and membership.state = 'active'
        and membership.role = 'staff'
    )
    + (
      select count(*)
      from public.invitations as invitation
      where invitation.organization_id = p_organization_id
        and invitation.accepted_at is null
        and invitation.revoked_at is null
        and invitation.expires_at > now()
    )
  into v_seats_in_use;

  if v_seats_in_use >= 10 then
    raise exception using errcode = 'RL002', message = 'Team is full.';
  end if;

  insert into public.invitations (
    organization_id,
    intended_email,
    role,
    token_hash,
    invited_by,
    expires_at
  )
  values (
    p_organization_id,
    v_email,
    'staff',
    extensions.digest(v_token_bytes, 'sha256'),
    v_actor_id,
    v_expires_at
  )
  returning id into v_invitation_id;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  values (
    p_organization_id,
    v_actor_id,
    'invitation.created',
    'invitation',
    v_invitation_id,
    pg_catalog.jsonb_build_object('email', v_email)
  );

  -- The plain token is returned once and never stored.
  return pg_catalog.jsonb_build_object(
    'invitation_id', v_invitation_id,
    'token', pg_catalog.encode(v_token_bytes, 'hex'),
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.revoke_invitation(
  p_organization_id uuid,
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_revoked_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  update public.invitations as invitation
  set revoked_at = now()
  where invitation.organization_id = p_organization_id
    and invitation.id = p_invitation_id
    and invitation.accepted_at is null
    and invitation.revoked_at is null
  returning invitation.id into v_revoked_id;

  if v_revoked_id is null then
    raise exception using errcode = 'P0002', message = 'Pending invitation not found.';
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id,
    v_actor_id,
    'invitation.revoked',
    'invitation',
    p_invitation_id
  );
end;
$$;

-- Safe summary for the invitation page. Knowing the token is the capability;
-- nothing beyond the café name and the invitation state is revealed.
create or replace function public.get_invitation_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_token_hash bytea := private.invitation_token_hash(p_token);
  v_invitation public.invitations%rowtype;
  v_cafe_name text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if v_token_hash is null then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select invitation.*
  into v_invitation
  from public.invitations as invitation
  where invitation.token_hash = v_token_hash;

  if not found then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select organization.name
  into v_cafe_name
  from public.organizations as organization
  where organization.id = v_invitation.organization_id;

  v_status := case
    when v_invitation.accepted_at is not null then 'accepted'
    when v_invitation.revoked_at is not null then 'revoked'
    when v_invitation.expires_at <= now() then 'expired'
    else 'valid'
  end;

  return pg_catalog.jsonb_build_object(
    'status', v_status,
    'cafe_name', v_cafe_name,
    'email_matches',
      coalesce(private.current_verified_email() = v_invitation.intended_email, false)
  );
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text := private.current_verified_email();
  v_token_hash bytea := private.invitation_token_hash(p_token);
  v_invitation public.invitations%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if v_token_hash is null then
    raise exception using errcode = 'P0002', message = 'Invitation not found.';
  end if;

  -- Lock the invitation so two concurrent accepts cannot both succeed.
  select invitation.*
  into v_invitation
  from public.invitations as invitation
  where invitation.token_hash = v_token_hash
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Invitation not found.';
  end if;

  if v_invitation.accepted_at is not null then
    if v_invitation.accepted_by = v_actor_id then
      return v_invitation.organization_id;
    end if;

    raise exception using errcode = 'RL003', message = 'Invitation already used.';
  end if;

  if v_invitation.revoked_at is not null then
    raise exception using errcode = 'RL004', message = 'Invitation revoked.';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception using errcode = 'RL005', message = 'Invitation expired.';
  end if;

  if v_actor_email is null or v_actor_email <> v_invitation.intended_email then
    raise exception using errcode = 'RL006', message = 'Invitation is for a different account.';
  end if;

  if exists (
    select 1
    from public.memberships as membership
    where membership.user_id = v_actor_id
      and membership.state = 'active'
      and membership.organization_id <> v_invitation.organization_id
  ) then
    raise exception using errcode = 'RL007', message = 'Already a member of another organization.';
  end if;

  -- A previously removed member is reactivated; an active member is left as is.
  insert into public.memberships as membership (
    organization_id, user_id, role, state
  )
  values (
    v_invitation.organization_id, v_actor_id, v_invitation.role, 'active'
  )
  on conflict (organization_id, user_id) do update
  set role = excluded.role,
      state = 'active',
      removed_at = null,
      joined_at = now()
  where membership.state = 'removed';

  update public.invitations as invitation
  set accepted_at = now(),
      accepted_by = v_actor_id
  where invitation.id = v_invitation.id;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    v_invitation.organization_id,
    v_actor_id,
    'invitation.accepted',
    'invitation',
    v_invitation.id
  );

  return v_invitation.organization_id;
end;
$$;

create or replace function public.remove_member(
  p_organization_id uuid,
  p_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_target_user_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  select membership.user_id
  into v_target_user_id
  from public.memberships as membership
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id
    and membership.state = 'active'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active member not found.';
  end if;

  if v_target_user_id = v_actor_id then
    raise exception using errcode = 'RL008', message = 'Owners cannot remove themselves.';
  end if;

  -- Row-level security reads membership state on every query, so access ends
  -- as soon as this commits.
  update public.memberships as membership
  set state = 'removed',
      removed_at = now()
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id,
    v_actor_id,
    'membership.removed',
    'membership',
    p_membership_id
  );
end;
$$;

-- Member emails live in auth.users, which the browser cannot read directly.
create or replace function public.list_team_members(p_organization_id uuid)
returns table (
  membership_id uuid,
  email text,
  role text,
  joined_at timestamptz,
  is_self boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.id,
    member_user.email::text,
    membership.role,
    membership.joined_at,
    membership.user_id = auth.uid()
  from public.memberships as membership
  join auth.users as member_user
    on member_user.id = membership.user_id
  where membership.organization_id = p_organization_id
    and membership.state = 'active'
    and private.is_owner(p_organization_id)
  order by (membership.role = 'owner') desc, membership.joined_at, membership.id;
$$;

-- Currency is fixed after creation because recorded costs depend on it.
create or replace function public.update_organization(
  p_organization_id uuid,
  p_name text,
  p_location_name text,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_location_name text := btrim(coalesce(p_location_name, ''));
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid organization name.';
  end if;

  if char_length(v_location_name) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Invalid location name.';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception using errcode = '22023', message = 'Invalid timezone.';
  end if;

  update public.organizations as organization
  set name = v_name,
      timezone = p_timezone
  where organization.id = p_organization_id;

  update public.locations as location
  set name = v_location_name
  where location.organization_id = p_organization_id;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id
  )
  values (
    p_organization_id,
    v_actor_id,
    'organization.updated',
    'organization',
    p_organization_id
  );
end;
$$;

revoke all on function public.create_invitation(uuid, text) from public, anon;
revoke all on function public.revoke_invitation(uuid, uuid) from public, anon;
revoke all on function public.get_invitation_preview(text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.list_team_members(uuid) from public, anon;
revoke all on function public.update_organization(uuid, text, text, text)
  from public, anon;

grant execute on function public.create_invitation(uuid, text) to authenticated;
grant execute on function public.revoke_invitation(uuid, uuid) to authenticated;
grant execute on function public.get_invitation_preview(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.list_team_members(uuid) to authenticated;
grant execute on function public.update_organization(uuid, text, text, text)
  to authenticated;

-- Owners list pending invitations directly; the token hash stays unreadable.
revoke select on public.invitations from authenticated;
grant select (
  id,
  organization_id,
  intended_email,
  role,
  expires_at,
  accepted_at,
  revoked_at,
  created_at
) on public.invitations to authenticated;

notify pgrst, 'reload schema';

commit;
