# RepairLog Supabase database

This directory is the table-by-table source of truth for the launch database.
Run the SQL files in filename order. The order is intentional: referenced
tables are created before their dependants, authorization helpers are created
after memberships, and policies are applied last.

```text
database/
|-- 000_foundation.sql
|-- 010_organizations.sql
|-- 020_locations.sql
|-- 030_memberships.sql
|-- 040_invitations.sql
|-- 050_equipment.sql
|-- 060_tickets.sql
|-- 070_repair_updates.sql
|-- 080_repair_costs.sql
|-- 090_attachments.sql
|-- 100_menu_items.sql
|-- 110_menu_dependencies.sql
|-- 120_user_preferences.sql
|-- 130_audit_events.sql
|-- 140_billing_checkout_attempts.sql
|-- 150_billing_subscriptions.sql
|-- 160_billing_invoices.sql
|-- 170_billing_events.sql
|-- 180_jobs.sql
|-- 800_authorization_helpers.sql
|-- 810_integrity_triggers.sql
|-- 820_organization_functions.sql
|-- 900_row_level_security.sql
|-- 910_storage.sql
|-- 920_fix_create_organization_ambiguous_id.sql
|-- 930_fix_create_organization_audit_mapping.sql
|-- 940_equipment_module.sql
|-- 950_team_module.sql
|-- 960_pilot_owner_access.sql
|-- 970_public_reports.sql
|-- 980_tickets_module.sql
|-- 990_menu_impact.sql
|-- 995_first_use_tips.sql
`-- 1000_open_signup.sql
```

## Rules represented here

- UUID primary keys and UTC `timestamptz` values.
- Every tenant-owned relationship carries `organization_id`.
- Money uses integer minor units plus ISO-style currency codes.
- Browser-visible tables use default-deny row-level security.
- Staff cannot read costs, billing, invitations, or organization audit data.
- Launch organizations have exactly one location, and tickets have at most two
  photo attachment slots.
- Direct business writes are revoked; application writes should use narrowly
  granted database functions that validate identity, expected row version, and
  subscription entitlement.
- Organization onboarding is an idempotent atomic function that creates the
  organization, first location, owner membership, and audit event together.
- Equipment writes are owner-only RPCs with idempotent creation, optimistic
  version checks, audit events, archiving, and revocable public QR codes.
- Team writes are owner-only RPCs. Invitation links carry a random token whose
  SHA-256 hash is the only stored form; acceptance requires the invited,
  verified Google email, and removing a member ends access immediately.
- Café creation is limited to emails in `pilot_owner_emails` once
  `960_pilot_owner_access.sql` is applied.
- Public QR reports are stored only by the application server, which supplies
  a salted hash of the reporter's address for rate limiting. A report changes
  nothing until an owner accepts it into exactly one ticket or dismisses it.
- The Supabase secret key is reserved for narrow billing/recovery workers.
- Lemon Squeezy fields are stored as a local projection, not locally invented
  financial truth.

For deployment, concatenate these files in order into one timestamped file in
`supabase/migrations/`, or preserve this same order in generated migrations.
Never modify an already-applied production migration; add a new migration.
