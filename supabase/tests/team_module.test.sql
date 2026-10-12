begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email, aud, role, email_confirmed_at)
values
  ('88888888-8888-4888-8888-888888888888', 'team-owner@repairlog.test', 'authenticated', 'authenticated', now()),
  ('99999999-9999-4999-8999-999999999999', 'team-staff@repairlog.test', 'authenticated', 'authenticated', now()),
  ('abababab-abab-4bab-8bab-abababababab', 'team-other@repairlog.test', 'authenticated', 'authenticated', now());

insert into public.organizations (
  id, name, currency, timezone, created_by, creation_request_id
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Team Test Cafe',
  'USD',
  'America/New_York',
  '88888888-8888-4888-8888-888888888888',
  '90909090-9090-4090-8090-909090909090'
);

insert into public.locations (id, organization_id, name)
values (
  'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Downtown'
);

insert into public.memberships (organization_id, user_id, role, state)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '88888888-8888-4888-8888-888888888888',
  'owner',
  'active'
);

set local role authenticated;

-- Owner creates an invitation; the plain token is kept for later steps.
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select set_config(
      'test.invitation_token',
      public.create_invitation(
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '  Team-Staff@RepairLog.test '
      ) ->> 'token',
      true
    )
  $$,
  'Owner can create an invitation'
);

select matches(
  current_setting('test.invitation_token'),
  '^[0-9a-f]{64}$',
  'The invitation token is 32 random bytes in hex'
);

select is(
  (
    select count(*)::integer
    from public.invitations
    where organization_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and intended_email = 'team-staff@repairlog.test'
      and accepted_at is null
      and revoked_at is null
  ),
  1,
  'The email is normalized and one pending invitation exists'
);

select throws_ok(
  $$ select token_hash from public.invitations $$,
  '42501',
  null,
  'The token hash column cannot be read through the API role'
);

select throws_ok(
  $$
    select public.create_invitation(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'team-owner@repairlog.test'
    )
  $$,
  'RL001',
  'Already an active member.',
  'An active member cannot be invited again'
);

-- A different Google account cannot use the link.
select set_config(
  'request.jwt.claims',
  '{"sub":"abababab-abab-4bab-8bab-abababababab","role":"authenticated"}',
  true
);

select is(
  public.get_invitation_preview(current_setting('test.invitation_token'))
    ->> 'email_matches',
  'false',
  'The preview reports an email mismatch for another account'
);

select throws_ok(
  $$ select public.accept_invitation(current_setting('test.invitation_token')) $$,
  'RL006',
  'Invitation is for a different account.',
  'Only the invited email can accept'
);

select throws_ok(
  $$
    select public.create_invitation(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'someone@repairlog.test'
    )
  $$,
  '42501',
  'Owner access required.',
  'A non-member cannot create invitations'
);

-- The invited account accepts.
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',
  true
);

select is(
  public.accept_invitation(current_setting('test.invitation_token')),
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  'The invited account joins the organization'
);

select is(
  public.accept_invitation(current_setting('test.invitation_token')),
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  'Retrying acceptance by the same account is idempotent'
);

select is(
  (select count(*)::integer from public.organizations),
  1,
  'The new staff member can read the organization'
);

select throws_ok(
  $$
    select public.remove_member(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      (select id from public.memberships where user_id = auth.uid())
    )
  $$,
  '42501',
  'Owner access required.',
  'Staff cannot remove members'
);

-- Owner removes the staff member.
select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.remove_member(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      (select id from public.memberships where user_id = auth.uid())
    )
  $$,
  'RL008',
  'Owners cannot remove themselves.',
  'An owner cannot remove their own membership'
);

select lives_ok(
  $$
    select public.remove_member(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      (
        select membership_id
        from public.list_team_members('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
        where email = 'team-staff@repairlog.test'
      )
    )
  $$,
  'Owner can remove a staff member'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.organizations),
  0,
  'A removed member loses access immediately'
);

select * from finish();

rollback;
