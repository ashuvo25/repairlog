begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- Fixed, clearly synthetic identities keep expected results readable. The
-- transaction rolls every fixture back when the test finishes.
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-a@repairlog.test', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'staff-a@repairlog.test', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'owner-b@repairlog.test', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-8444-444444444444', 'removed@repairlog.test', 'authenticated', 'authenticated');

insert into public.organizations (
  id, name, currency, timezone, created_by, creation_request_id
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Cafe A',
    'USD',
    'Asia/Dhaka',
    '11111111-1111-4111-8111-111111111111',
    '10101010-1010-4010-8010-101010101010'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Cafe B',
    'USD',
    'America/New_York',
    '33333333-3333-4333-8333-333333333333',
    '20202020-2020-4020-8020-202020202020'
  );

insert into public.locations (id, organization_id, name)
values
  ('a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Main Cafe'),
  ('b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b0b0', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Main Cafe');

insert into public.memberships (
  organization_id, user_id, role, state, removed_at
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner', 'active', null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'staff', 'active', null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'owner', 'active', null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'staff', 'removed', now());

insert into public.equipment (
  id, organization_id, location_id, name, category, condition
)
values
  (
    'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0',
    'Espresso Machine A',
    'Coffee',
    'operational'
  ),
  (
    'ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b0b0',
    'Espresso Machine B',
    'Coffee',
    'operational'
  );

insert into public.tickets (
  id,
  organization_id,
  equipment_id,
  reporter_id,
  client_request_id,
  category,
  priority,
  description
)
values (
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  '30303030-3030-4030-8030-303030303030',
  'Pressure',
  'high',
  'Pressure drops during extraction.'
);

insert into public.repair_costs (
  organization_id,
  ticket_id,
  recorded_by,
  amount_minor,
  currency,
  recorded_date
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  12550,
  'USD',
  current_date
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select results_eq(
  $$select id from public.organizations order by id$$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'Owner A sees only Cafe A'
);

select results_eq(
  $$select id from public.equipment order by id$$,
  $$values ('eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'Owner A sees only Cafe A equipment'
);

select is(
  (select count(*)::integer from public.repair_costs),
  1,
  'Owner A can read Cafe A repair costs'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select results_eq(
  $$select user_id from public.memberships order by user_id$$,
  $$values ('22222222-2222-4222-8222-222222222222'::uuid)$$,
  'Staff sees only their own membership row'
);

select is(
  (select count(*)::integer from public.repair_costs),
  0,
  'Staff cannot read repair costs'
);

select is(
  (select count(*)::integer from public.equipment),
  1,
  'Staff can read equipment in their own Cafe'
);

select ok(
  not has_table_privilege('authenticated', 'public.equipment', 'INSERT'),
  'Authenticated clients cannot bypass equipment workflow with direct inserts'
);

select ok(
  not has_table_privilege('authenticated', 'public.billing_events', 'SELECT'),
  'Raw billing events are not client-readable'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select results_eq(
  $$select id from public.organizations order by id$$,
  $$values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)$$,
  'Owner B cannot read Cafe A'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.organizations),
  0,
  'Removed staff immediately lose tenant access'
);

select * from finish();

rollback;
