begin;

-- Tickets module: team members open tickets and move them through the repair
-- workflow; only an owner verifies a resolution, reopens a ticket, or records
-- repair work and costs. Ticket status never changes equipment condition.
--
-- Custom SQLSTATE codes:
--   RL030 that status change is not allowed from the current status
--   RL031 only an owner can verify a resolution
--   RL032 the ticket is resolved; reopen it first

alter table public.repair_updates
  add column if not exists creation_request_id uuid;

create unique index if not exists repair_updates_creation_request_idx
  on public.repair_updates (organization_id, author_id, creation_request_id)
  where creation_request_id is not null;

create or replace function public.create_ticket(
  p_organization_id uuid,
  p_request_id uuid,
  p_equipment_id uuid,
  p_priority text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_priority text := lower(btrim(coalesce(p_priority, '')));
  v_description text := btrim(coalesce(p_description, ''));
  v_category text;
  v_ticket_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_active_member(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Membership required.';
  end if;

  if p_request_id is null then
    raise exception using errcode = '22023', message = 'Request ID is required.';
  end if;

  if v_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception using errcode = '22023', message = 'Invalid priority.';
  end if;

  if char_length(v_description) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'Invalid description.';
  end if;

  select ticket.id
  into v_ticket_id
  from public.tickets as ticket
  where ticket.organization_id = p_organization_id
    and ticket.reporter_id = v_actor_id
    and ticket.client_request_id = p_request_id;

  if v_ticket_id is not null then
    return v_ticket_id;
  end if;

  select equipment.category
  into v_category
  from public.equipment as equipment
  where equipment.organization_id = p_organization_id
    and equipment.id = p_equipment_id
    and equipment.archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active equipment not found.';
  end if;

  insert into public.tickets (
    organization_id,
    equipment_id,
    reporter_id,
    client_request_id,
    category,
    priority,
    status,
    description
  )
  values (
    p_organization_id,
    p_equipment_id,
    v_actor_id,
    p_request_id,
    v_category,
    v_priority,
    'open',
    v_description
  )
  on conflict (organization_id, reporter_id, client_request_id) do nothing
  returning id into v_ticket_id;

  if v_ticket_id is null then
    select ticket.id
    into v_ticket_id
    from public.tickets as ticket
    where ticket.organization_id = p_organization_id
      and ticket.reporter_id = v_actor_id
      and ticket.client_request_id = p_request_id;
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, request_id
  )
  values (
    p_organization_id, v_actor_id, 'ticket.created', 'ticket', v_ticket_id, p_request_id
  );

  return v_ticket_id;
end;
$$;

-- Moves a ticket between open, in_progress, awaiting_verification and
-- resolved. Resolving is the owner's verification step.
create or replace function public.set_ticket_status(
  p_organization_id uuid,
  p_ticket_id uuid,
  p_expected_version integer,
  p_status text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_current_status text;
  v_current_version integer;
  v_new_version integer;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_active_member(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Membership required.';
  end if;

  if v_status not in ('open', 'in_progress', 'awaiting_verification', 'resolved') then
    raise exception using errcode = '22023', message = 'Invalid status.';
  end if;

  select ticket.status, ticket.version
  into v_current_status, v_current_version
  from public.tickets as ticket
  where ticket.organization_id = p_organization_id
    and ticket.id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Ticket not found.';
  end if;

  if v_current_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Ticket changed. Refresh and try again.';
  end if;

  if v_current_status = 'resolved' then
    raise exception using errcode = 'RL032', message = 'Ticket is resolved.';
  end if;

  if v_current_status = v_status then
    raise exception using errcode = 'RL030', message = 'Status change not allowed.';
  end if;

  if v_status = 'resolved' then
    if not private.is_owner(p_organization_id, v_actor_id) then
      raise exception using errcode = 'RL031', message = 'Owner verification required.';
    end if;

    if v_current_status <> 'awaiting_verification' then
      raise exception using errcode = 'RL030', message = 'Status change not allowed.';
    end if;

    update public.tickets as ticket
    set status = 'resolved',
        resolved_at = now(),
        resolved_by = v_actor_id
    where ticket.organization_id = p_organization_id
      and ticket.id = p_ticket_id
    returning ticket.version into v_new_version;
  else
    update public.tickets as ticket
    set status = v_status
    where ticket.organization_id = p_organization_id
      and ticket.id = p_ticket_id
    returning ticket.version into v_new_version;
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  values (
    p_organization_id,
    v_actor_id,
    'ticket.status_changed',
    'ticket',
    p_ticket_id,
    pg_catalog.jsonb_build_object('from', v_current_status, 'to', v_status)
  );

  return v_new_version;
end;
$$;

create or replace function public.reopen_ticket(
  p_organization_id uuid,
  p_ticket_id uuid,
  p_expected_version integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_new_version integer;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not private.is_owner(p_organization_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'Owner access required.';
  end if;

  if char_length(v_reason) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'A reason is required.';
  end if;

  update public.tickets as ticket
  set status = 'open',
      resolved_at = null,
      resolved_by = null,
      reopened_reason = v_reason
  where ticket.organization_id = p_organization_id
    and ticket.id = p_ticket_id
    and ticket.version = p_expected_version
    and ticket.status = 'resolved'
  returning ticket.version into v_new_version;

  if v_new_version is null then
    if exists (
      select 1
      from public.tickets as ticket
      where ticket.organization_id = p_organization_id
        and ticket.id = p_ticket_id
        and ticket.status = 'resolved'
    ) then
      raise exception using errcode = '40001', message = 'Ticket changed. Refresh and try again.';
    end if;

    raise exception using errcode = 'P0002', message = 'Resolved ticket not found.';
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  )
  values (
    p_organization_id,
    v_actor_id,
    'ticket.reopened',
    'ticket',
    p_ticket_id,
    pg_catalog.jsonb_build_object('reason', v_reason)
  );

  return v_new_version;
end;
$$;

-- Records repair work, with an optional cost in the café's currency. Costs
-- live in their own owner-only table, so staff never see amounts.
create or replace function public.add_repair_update(
  p_organization_id uuid,
  p_ticket_id uuid,
  p_request_id uuid,
  p_technician_name text,
  p_work_note text,
  p_work_date date,
  p_cost_minor bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_technician_name text := nullif(btrim(coalesce(p_technician_name, '')), '');
  v_work_note text := btrim(coalesce(p_work_note, ''));
  v_ticket_status text;
  v_currency text;
  v_update_id uuid;
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

  if v_technician_name is not null and char_length(v_technician_name) > 120 then
    raise exception using errcode = '22023', message = 'Invalid technician name.';
  end if;

  if char_length(v_work_note) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'Invalid work note.';
  end if;

  if p_work_date is null
    or p_work_date > (now() + interval '1 day')::date
    or p_work_date < date '2000-01-01' then
    raise exception using errcode = '22023', message = 'Invalid work date.';
  end if;

  if p_cost_minor is not null
    and (p_cost_minor < 0 or p_cost_minor > 100000000) then
    raise exception using errcode = '22023', message = 'Invalid cost.';
  end if;

  select repair_update.id
  into v_update_id
  from public.repair_updates as repair_update
  where repair_update.organization_id = p_organization_id
    and repair_update.author_id = v_actor_id
    and repair_update.creation_request_id = p_request_id;

  if v_update_id is not null then
    return v_update_id;
  end if;

  select ticket.status
  into v_ticket_status
  from public.tickets as ticket
  where ticket.organization_id = p_organization_id
    and ticket.id = p_ticket_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Ticket not found.';
  end if;

  if v_ticket_status = 'resolved' then
    raise exception using errcode = 'RL032', message = 'Ticket is resolved.';
  end if;

  insert into public.repair_updates (
    organization_id,
    ticket_id,
    author_id,
    technician_name,
    work_note,
    work_date,
    creation_request_id
  )
  values (
    p_organization_id,
    p_ticket_id,
    v_actor_id,
    v_technician_name,
    v_work_note,
    p_work_date,
    p_request_id
  )
  returning id into v_update_id;

  if p_cost_minor is not null and p_cost_minor > 0 then
    select organization.currency
    into v_currency
    from public.organizations as organization
    where organization.id = p_organization_id;

    insert into public.repair_costs (
      organization_id, ticket_id, recorded_by, amount_minor, currency, recorded_date, note
    )
    values (
      p_organization_id,
      p_ticket_id,
      v_actor_id,
      p_cost_minor,
      v_currency,
      p_work_date,
      left(v_work_note, 1000)
    );
  end if;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, request_id
  )
  values (
    p_organization_id, v_actor_id, 'repair_update.created', 'ticket', p_ticket_id, p_request_id
  );

  return v_update_id;
end;
$$;

-- Repair history with the email of whoever recorded each entry. Emails live
-- in auth.users, which the browser cannot read directly.
create or replace function public.list_repair_updates(
  p_organization_id uuid,
  p_ticket_id uuid
)
returns table (
  update_id uuid,
  technician_name text,
  work_note text,
  work_date date,
  recorded_by_email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    repair_update.id,
    repair_update.technician_name,
    repair_update.work_note,
    repair_update.work_date,
    author.email::text,
    repair_update.created_at
  from public.repair_updates as repair_update
  join auth.users as author
    on author.id = repair_update.author_id
  where repair_update.organization_id = p_organization_id
    and repair_update.ticket_id = p_ticket_id
    and private.is_active_member(p_organization_id)
  order by repair_update.work_date desc, repair_update.created_at desc;
$$;

revoke all on function public.create_ticket(uuid, uuid, uuid, text, text)
  from public, anon;
revoke all on function public.set_ticket_status(uuid, uuid, integer, text)
  from public, anon;
revoke all on function public.reopen_ticket(uuid, uuid, integer, text)
  from public, anon;
revoke all on function public.add_repair_update(uuid, uuid, uuid, text, text, date, bigint)
  from public, anon;
revoke all on function public.list_repair_updates(uuid, uuid)
  from public, anon;

grant execute on function public.create_ticket(uuid, uuid, uuid, text, text)
  to authenticated;
grant execute on function public.set_ticket_status(uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.reopen_ticket(uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.add_repair_update(uuid, uuid, uuid, text, text, date, bigint)
  to authenticated;
grant execute on function public.list_repair_updates(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
