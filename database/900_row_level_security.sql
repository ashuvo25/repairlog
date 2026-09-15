begin;

alter table public.organizations enable row level security;
alter table public.locations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.equipment enable row level security;
alter table public.tickets enable row level security;
alter table public.repair_updates enable row level security;
alter table public.repair_costs enable row level security;
alter table public.attachments enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_dependencies enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_events enable row level security;
alter table public.billing_checkout_attempts enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_events enable row level security;
alter table public.jobs enable row level security;

revoke all on table
  public.organizations,
  public.locations,
  public.memberships,
  public.invitations,
  public.equipment,
  public.tickets,
  public.repair_updates,
  public.repair_costs,
  public.attachments,
  public.menu_items,
  public.menu_dependencies,
  public.user_preferences,
  public.audit_events,
  public.billing_checkout_attempts,
  public.billing_subscriptions,
  public.billing_invoices,
  public.billing_events,
  public.jobs
from anon;

revoke all on table
  public.organizations,
  public.locations,
  public.memberships,
  public.invitations,
  public.equipment,
  public.tickets,
  public.repair_updates,
  public.repair_costs,
  public.attachments,
  public.menu_items,
  public.menu_dependencies,
  public.user_preferences,
  public.audit_events,
  public.billing_checkout_attempts,
  public.billing_subscriptions,
  public.billing_invoices,
  public.billing_events,
  public.jobs
from authenticated;

grant select on public.organizations to authenticated;
grant select on public.locations to authenticated;
grant select on public.memberships to authenticated;
grant select on public.invitations to authenticated;
grant select on public.equipment to authenticated;
grant select on public.tickets to authenticated;
grant select on public.repair_updates to authenticated;
grant select on public.repair_costs to authenticated;
grant select on public.attachments to authenticated;
grant select on public.menu_items to authenticated;
grant select on public.menu_dependencies to authenticated;
grant select on public.user_preferences to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.billing_checkout_attempts to authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_invoices to authenticated;

drop policy if exists organizations_select_active_member on public.organizations;
create policy organizations_select_active_member
on public.organizations for select to authenticated
using (private.is_active_member(id));

drop policy if exists locations_select_active_member on public.locations;
create policy locations_select_active_member
on public.locations for select to authenticated
using (private.is_active_member(organization_id));

drop policy if exists memberships_select_self_or_owner on public.memberships;
create policy memberships_select_self_or_owner
on public.memberships for select to authenticated
using (
  user_id = auth.uid()
  or private.is_owner(organization_id)
);

drop policy if exists invitations_select_owner on public.invitations;
create policy invitations_select_owner
on public.invitations for select to authenticated
using (private.is_owner(organization_id));

drop policy if exists equipment_select_active_member on public.equipment;
create policy equipment_select_active_member
on public.equipment for select to authenticated
using (private.is_active_member(organization_id));

drop policy if exists tickets_select_active_member on public.tickets;
create policy tickets_select_active_member
on public.tickets for select to authenticated
using (private.is_active_member(organization_id));

drop policy if exists repair_updates_select_active_member on public.repair_updates;
create policy repair_updates_select_active_member
on public.repair_updates for select to authenticated
using (private.is_active_member(organization_id));

drop policy if exists repair_costs_select_owner on public.repair_costs;
create policy repair_costs_select_owner
on public.repair_costs for select to authenticated
using (private.is_owner(organization_id));

drop policy if exists attachments_select_active_member on public.attachments;
create policy attachments_select_active_member
on public.attachments for select to authenticated
using (private.is_active_member(organization_id));

drop policy if exists menu_items_select_active_member on public.menu_items;
create policy menu_items_select_active_member
on public.menu_items for select to authenticated
using (private.is_active_member(organization_id));

drop policy if exists menu_dependencies_select_active_member
  on public.menu_dependencies;
create policy menu_dependencies_select_active_member
on public.menu_dependencies for select to authenticated
using (private.is_active_member(organization_id));

drop policy if exists user_preferences_select_self on public.user_preferences;
create policy user_preferences_select_self
on public.user_preferences for select to authenticated
using (
  user_id = auth.uid()
  and private.is_active_member(organization_id)
);

drop policy if exists audit_events_select_owner on public.audit_events;
create policy audit_events_select_owner
on public.audit_events for select to authenticated
using (private.is_owner(organization_id));

drop policy if exists billing_checkout_attempts_select_owner
  on public.billing_checkout_attempts;
create policy billing_checkout_attempts_select_owner
on public.billing_checkout_attempts for select to authenticated
using (private.is_owner(organization_id));

drop policy if exists billing_subscriptions_select_owner
  on public.billing_subscriptions;
create policy billing_subscriptions_select_owner
on public.billing_subscriptions for select to authenticated
using (private.is_owner(organization_id));

drop policy if exists billing_invoices_select_owner on public.billing_invoices;
create policy billing_invoices_select_owner
on public.billing_invoices for select to authenticated
using (private.is_owner(organization_id));

commit;
