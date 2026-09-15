# RepairLog folder structure

RepairLog is a single Next.js modular monolith. Route folders define screens and
HTTP endpoints; domain modules own business logic; Supabase migrations own
database invariants and row-level security.

## Top-level boundaries

```text
repairlog/
|-- app/                    # Next.js pages, layouts, and HTTP endpoints
|-- components/             # Reusable presentation components
|-- database/               # Table-by-table Supabase SQL source
|-- lib/                    # Domain logic and infrastructure adapters
|-- netlify/functions/      # Scheduled operational workers
|-- supabase/migrations/    # Schema, indexes, RLS, and database functions
|-- tests/                  # Security, workflow, billing, recovery, and E2E tests
|-- scripts/                # Operator-run backup and restore tooling
|-- types/                  # Shared and generated TypeScript types
`-- docs/architecture/      # Architecture decisions and structure documentation
```

## Application routes

```text
app/
|-- (marketing)/
|   |-- pricing/
|   |-- privacy/
|   |-- terms/
|   `-- support/
|-- (auth)/
|   |-- sign-in/
|   |-- register/
|   |-- forgot-password/
|   |-- reset-password/
|   `-- invitation/[token]/
|-- (dashboard)/
|   |-- today/
|   |-- equipment/
|   |   |-- new/
|   |   `-- [equipmentId]/
|   |       |-- edit/
|   |       `-- qr/
|   |-- report/[equipmentId]/
|   |-- tickets/
|   |   `-- [ticketId]/
|   |-- menu-impact/
|   `-- settings/
|       |-- organization/
|       |-- team/
|       `-- billing/
`-- api/
    |-- billing/
    |   |-- checkout/
    |   `-- portal/
    `-- webhooks/lemonsqueezy/
```

Route groups do not change public URLs. The existing root `app/page.tsx`
remains the landing page until the marketing implementation is moved into its
final route group.

## Business and infrastructure modules

```text
lib/
|-- auth/                   # Session and identity helpers
|-- permissions/            # Owner/staff action checks
|-- validation/             # Bounded input schemas and validation errors
|-- supabase/
|   |-- browser/            # Publishable-key client; RLS always applies
|   |-- server/             # User-scoped server client; RLS still applies
|   `-- admin/              # Server-only elevated client for narrow jobs
|-- modules/
|   |-- organizations/      # Organization and single launch location
|   |-- team/               # Memberships and secure invitations
|   |-- equipment/          # Machines, condition, archive, and QR data
|   |-- tickets/            # Idempotent fault intake and ticket workflow
|   |-- repairs/            # Work updates and owner verification
|   |-- costs/              # Owner-only repair expenses in minor units
|   |-- attachments/        # Private photo lifecycle and signed access
|   |-- menu-impact/        # Menu dependencies and availability rules
|   |-- today/              # Indexed operational summary queries
|   |-- onboarding/         # Checklist and dismissed tips
|   |-- billing/            # Entitlements and local billing projection
|   |-- audit/              # Security-relevant event recording
|   `-- exports/            # Owner-only recovery/export reads
|-- providers/
|   `-- lemonsqueezy/       # The one billing-provider adapter
`-- jobs/
    `-- billing/            # Lease, retry, sync, and reconciliation handlers
```

Each domain module can add `queries.ts`, `actions.ts`, `schemas.ts`, `types.ts`,
and `constants.ts` only when needed. Business writes must flow through a server
action/route into an atomic database function; UI components must not contain
authorization or workflow rules.

## Shared UI

```text
components/
|-- ui/                     # Buttons, inputs, dialogs, badges
|-- layout/                 # Public and authenticated shells/navigation
|-- forms/                  # Reusable form presentation
|-- tables/                 # Responsive list/table presentation
`-- onboarding/             # Checklist, tips, and empty states
```

Feature-specific components should live beside their route until two or more
features genuinely share them.

## Database and verification

```text
supabase/migrations/
`-- YYYYMMDDHHMMSS_<area>_<change>.sql
    # Chronological schema, functions, RLS, storage policies, and indexes

tests/
|-- permissions/            # Cross-tenant and owner/staff authorization
|-- workflows/              # Fault, repair, menu-impact, and concurrency flows
|-- billing/                # Signatures, ordering, idempotency, entitlements
|-- recovery/               # Export, backup, and restore exercises
|-- e2e/                    # Mobile/desktop browser journeys
|-- load/                   # Controlled k6 pilot tests
`-- fixtures/               # Isolated realistic test records
```

Migration files remain directly executable in chronological order. Keep the
Supabase CLI migration directory flat and use descriptive filename prefixes to
show whether a change owns schema, functions, RLS, storage, or indexes.

## Non-negotiable dependency direction

```text
app/routes -> lib/modules -> lib/supabase
       |           |             |
       v           v             v
 components     permissions   PostgreSQL/RLS

netlify/functions -> lib/jobs -> lib/providers/lemonsqueezy
```

- Browser code may import only the browser Supabase client.
- Ordinary server mutations use the signed-in user's database identity.
- Only billing/recovery jobs use the elevated client.
- Financial tables never feed staff-readable queries.
- Lemon Squeezy data controls paid entitlement; redirect state does not.
- Equipment condition and ticket resolution remain independent states.
