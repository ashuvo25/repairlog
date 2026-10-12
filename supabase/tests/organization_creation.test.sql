begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, aud, role, email_confirmed_at)
values (
  '55555555-5555-4555-8555-555555555555',
  'organization-owner@repairlog.test',
  'authenticated',
  'authenticated',
  now()
);

-- Café creation is limited to the pilot allowlist (960_pilot_owner_access.sql).
insert into public.pilot_owner_emails (email)
values ('organization-owner@repairlog.test');

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.create_organization(
      '50505050-5050-4050-8050-505050505050',
      'Function Test Cafe',
      'USD',
      'Asia/Dhaka',
      'Main Cafe'
    )
  $$,
  'Organization creation completes without a SQL error'
);

select is(
  (
    select count(*)::integer
    from public.organizations
    where creation_request_id = '50505050-5050-4050-8050-505050505050'
  ),
  1,
  'Organization is created once'
);

select is(
  (
    select count(*)::integer
    from public.locations as location
    join public.organizations as organization
      on organization.id = location.organization_id
    where organization.creation_request_id =
      '50505050-5050-4050-8050-505050505050'
  ),
  1,
  'Initial location is created'
);

select is(
  (
    select count(*)::integer
    from public.memberships as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where organization.creation_request_id =
      '50505050-5050-4050-8050-505050505050'
      and membership.user_id =
        '55555555-5555-4555-8555-555555555555'
      and membership.role = 'owner'
      and membership.state = 'active'
  ),
  1,
  'Creator receives the active owner membership'
);

select is(
  (
    select count(*)::integer
    from public.audit_events as audit_event
    join public.organizations as organization
      on organization.id = audit_event.organization_id
    where organization.creation_request_id =
      '50505050-5050-4050-8050-505050505050'
      and audit_event.actor_id =
        '55555555-5555-4555-8555-555555555555'
      and audit_event.action = 'organization.created'
  ),
  1,
  'Creation audit event uses the real actor_id column'
);

select lives_ok(
  $$
    select public.create_organization(
      '50505050-5050-4050-8050-505050505050',
      'Function Test Cafe',
      'USD',
      'Asia/Dhaka',
      'Main Cafe'
    )
  $$,
  'Retrying the same request is idempotent'
);

select * from finish();

rollback;
