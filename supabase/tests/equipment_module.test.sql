begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, aud, role)
values
  ('66666666-6666-4666-8666-666666666666', 'equipment-owner@repairlog.test', 'authenticated', 'authenticated'),
  ('77777777-7777-4777-8777-777777777777', 'equipment-staff@repairlog.test', 'authenticated', 'authenticated');

insert into public.organizations (
  id, name, currency, timezone, created_by, creation_request_id
)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Equipment Test Cafe',
  'USD',
  'Asia/Dhaka',
  '66666666-6666-4666-8666-666666666666',
  '60606060-6060-4060-8060-606060606060'
);

insert into public.locations (id, organization_id, name)
values (
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Main Cafe'
);

insert into public.memberships (organization_id, user_id, role, state)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '66666666-6666-4666-8666-666666666666',
    'owner',
    'active'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '77777777-7777-4777-8777-777777777777',
    'staff',
    'active'
  );

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.create_equipment(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '70707070-7070-4070-8070-707070707070',
      'Espresso Machine',
      'Coffee'
    )
  $$,
  'Owner can create equipment'
);

select is(
  (
    select count(*)::integer
    from public.equipment
    where organization_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and creation_request_id = '70707070-7070-4070-8070-707070707070'
  ),
  1,
  'Idempotency key identifies one equipment record'
);

select lives_ok(
  $$
    select public.create_equipment(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '70707070-7070-4070-8070-707070707070',
      'Espresso Machine',
      'Coffee'
    )
  $$,
  'Retrying equipment creation succeeds'
);

select is(
  (
    select count(*)::integer
    from public.equipment
    where organization_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  ),
  1,
  'Retry does not create a duplicate'
);

select lives_ok(
  $$
    select public.update_equipment(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      (
        select id from public.equipment
        where creation_request_id = '70707070-7070-4070-8070-707070707070'
      ),
      1,
      'Bar Espresso Machine',
      'Espresso'
    )
  $$,
  'Owner can update equipment with the expected version'
);

select is(
  (
    select version
    from public.equipment
    where creation_request_id = '70707070-7070-4070-8070-707070707070'
  ),
  2,
  'Editing bumps the equipment version'
);

select lives_ok(
  $$
    select public.set_equipment_condition(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      (
        select id from public.equipment
        where creation_request_id = '70707070-7070-4070-8070-707070707070'
      ),
      2,
      'operational'
    )
  $$,
  'Owner can confirm equipment condition'
);

select is(
  (
    select condition
    from public.equipment
    where creation_request_id = '70707070-7070-4070-8070-707070707070'
  ),
  'operational',
  'Condition change is stored'
);

select lives_ok(
  $$
    select public.rotate_equipment_public_code(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      (
        select id from public.equipment
        where creation_request_id = '70707070-7070-4070-8070-707070707070'
      ),
      3
    )
  $$,
  'Owner can revoke the previous public QR code'
);

select lives_ok(
  $$
    select public.archive_equipment(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      (
        select id from public.equipment
        where creation_request_id = '70707070-7070-4070-8070-707070707070'
      ),
      4
    )
  $$,
  'Owner can archive equipment with the current version'
);

select ok(
  (
    select archived_at is not null and not public_reporting_enabled
    from public.equipment
    where creation_request_id = '70707070-7070-4070-8070-707070707070'
  ),
  'Archiving disables the public QR endpoint'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.create_equipment(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '80808080-8080-4080-8080-808080808080',
      'Staff-created machine',
      'Other'
    )
  $$,
  '42501',
  'Owner access required.',
  'Staff cannot create equipment through the RPC'
);

select * from finish();

rollback;
