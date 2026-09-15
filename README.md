# RepairLog

RepairLog is a responsive café equipment fault and repair-management system.
It helps a small café report machine problems quickly, understand which menu
items are affected, coordinate repair work, record costs, and preserve a useful
equipment history.

The first target is an invited production pilot with 3–5 independent cafés and
approximately 20–50 users. This repository is under active development and is
not yet evidence of production readiness.

## Product promise

A staff member should be able to scan a machine's QR code and submit a fault in
under one minute. The café owner should immediately be able to find the issue,
understand its service impact, manage its repair, and verify the outcome.

RepairLog is not an accounting platform, point-of-sale system, technician
marketplace, or predictive-maintenance product. At launch it is a focused
operational record for one café location per organization.

## Who uses RepairLog?

RepairLog has two application roles.

| Capability | Owner | Staff |
| --- | :---: | :---: |
| Sign in with Google | Yes | Yes |
| View equipment and open faults | Yes | Yes |
| Scan a QR code and report a fault | Yes | Yes |
| Add operational repair updates | Yes | Yes |
| Add, edit, archive, and print equipment QR codes | Yes | No |
| Confirm equipment condition | Yes | No |
| Verify or reopen a resolved ticket | Yes | No |
| Configure menu dependencies | Yes | No |
| Invite or remove staff | Yes | No |
| View and record repair costs | Yes | No |
| View exports, audit information, and billing | Yes | No |

The database—not hidden buttons—enforces these boundaries. Removing a staff
membership must immediately remove access to that café's records.

## Core concepts

### Organization and location

Each café is an organization. An organization has its own currency, timezone,
members, equipment, faults, costs, and billing record. Launch organizations
have one location. All tenant-owned database relationships carry an
`organization_id` so records from different cafés cannot be linked together.

### Equipment condition

Equipment condition is one of:

- `operational`
- `unavailable`
- `unknown`

A staff fault report does not automatically make equipment unavailable. Only
an owner confirms the operational condition.

### Ticket workflow

```text
Open -> In progress -> Awaiting verification -> Resolved
```

Only an owner verifies resolution. An owner can reopen a ticket with a reason.
Ticket status and equipment condition are independent: resolving a ticket must
never silently mark its equipment operational.

### Menu impact

Owners link menu items to the equipment required to prepare them.

- Every required machine operational → `Available`
- Any required machine unavailable → `Affected`
- Otherwise → `Unknown`
- No dependencies configured → `Not configured`

An owner may add a plain-text alternative instruction. That instruction does
not automatically represent a working replacement machine.

## End-to-end workflow simulation

The following example shows how the launch product should behave.

### 1. Owner sets up the café

Shuvo signs in with Google and creates **North Street Café**. He chooses `USD`,
the café's real IANA timezone, and creates its single launch location. RepairLog
creates his active owner membership in the same atomic operation.

He adds an **Espresso Machine**, assigns its category, and initially confirms it
as operational. RepairLog generates an equipment QR code, which he prints and
places beside the machine.

He creates the menu item **Latte** and links the Espresso Machine as a required
dependency. Latte now appears available because all its required equipment is
operational.

### 2. Owner invites a staff member

Shuvo sends an invitation to a specific staff email address. The invitation
stores a hash of its token, intended email, expiry, and acceptance state.

The staff member must sign into the correct Google account. RepairLog rejects
an expired, replayed, revoked, or wrong-email invitation. Once accepted, an
active staff membership grants access only to North Street Café.

### 3. Staff reports a fault

During service, the Espresso Machine begins losing pressure. The staff member
scans its QR code, signs in if necessary, and sees a short report form already
bound to that equipment.

They select a category and priority, describe the pressure problem, and submit
the text report. The browser supplies a unique request ID. If a slow connection
causes the user to submit twice, the database returns the original ticket
instead of creating a duplicate.

The text ticket is committed before photos. Up to two JPEG, PNG, or WebP photos
can then upload directly to the private Supabase Storage bucket. A failed image
upload can be retried without losing the fault report.

The new ticket is `open`, but the equipment condition remains unchanged until
the owner checks it.

### 4. Owner confirms operational impact

Shuvo opens the ticket, checks the machine, and changes its condition to
`unavailable`. Because Latte requires this machine, Latte becomes `Affected`.
The Today page includes the unresolved fault and affected menu item.

If another user changed the same equipment record first, RepairLog compares
record versions and returns a conflict instead of silently overwriting data.

### 5. Repair work is recorded

The ticket moves to `in_progress`. Staff can add operational notes, while the
owner records the technician's name, work performed, work date, and optional
repair cost. Costs use integer minor units—for example, `$125.50` is stored as
`12550` with currency `USD`—and remain invisible to staff.

After the technician finishes, the ticket moves to `awaiting_verification`.

### 6. Owner verifies the result

Shuvo tests the machine. If the repair failed, he returns the ticket to active
work. If it passed, he marks the ticket `resolved`. He separately confirms the
equipment as `operational`, after which Latte returns to `Available`.

The equipment detail page keeps the original report, attachments, repair
updates, technician details, cost history, authors, and timestamps.

## Today page

The Today page is the launch handover and daily-summary surface. It shows:

- unresolved faults;
- equipment and menu items currently affected;
- unknown equipment conditions requiring owner confirmation;
- today's owner-visible repair expenses; and
- when the displayed information was last refreshed.

The launch UI fetches on screen opening, refreshes after related mutations, and
refreshes stale information when the browser regains focus. It does not use
continuous polling or realtime subscriptions.

## System architecture

RepairLog is one Next.js modular monolith deployed to Netlify.

```text
Browser
|-- Supabase Auth (Google OAuth)
|-- compact RLS-protected reads through the Supabase Data API
|-- direct authorized uploads to private Supabase Storage
`-- business mutations sent to Next.js

Next.js on Netlify
|-- verifies identity, input, membership, role, and entitlement
|-- invokes atomic PostgreSQL mutation functions
|-- creates Lemon Squeezy checkout and portal requests
|-- verifies and persists Lemon Squeezy webhooks
`-- authorizes private file operations

Supabase
|-- PostgreSQL durable data
|-- row-level security and database constraints
|-- private image storage
`-- durable billing/reconciliation jobs

Netlify scheduled function
`-- bounded billing synchronization using database leases

Lemon Squeezy
`-- authoritative subscription and financial facts
```

There is no separate API server, permanent worker, Redis instance, LLM,
chatbot, native mobile app, or public image bucket at launch.

## Security model

- Every exposed application table has row-level security enabled.
- Browser requests use the publishable key and the signed-in user's session.
- Ordinary server mutations retain the user's database identity, so RLS still
  applies.
- Only narrow billing and recovery work may use the server-only Supabase secret
  key.
- Financial tables are separate from staff-readable operational tables.
- Business writes use atomic database functions and expected record versions.
- Cookie-authenticated endpoints validate request origin.
- Invitation acceptance validates intended email, expiry, replay, and revocation.
- The last active owner cannot be removed.
- Private image paths are random and tenant-scoped; signed links are short-lived.
- Secrets must never be committed, logged, sent to the browser, or pasted into
  ordinary chat.

## Billing access policy

Lemon Squeezy owns subscription status and financial dates. RepairLog stores a
local projection for authorization and display.

| Provider status | RepairLog access |
| --- | --- |
| `on_trial` | Allowed until the provider trial boundary |
| `active` | Allowed |
| `cancelled` | Allowed only until provider `ends_at` |
| `past_due` | Existing operations remain available during provider retries; owner sees a payment action |
| `unpaid` or `expired` | Read, export, and billing only; new paid operations blocked |
| `paused` | Read, export, and billing only |
| Unknown or absent | Onboarding, demo, and billing only |

A checkout redirect never grants access. Verified webhook processing and
canonical provider reconciliation update the billing projection. If projection
data is older than 24 hours, new paid writes are restricted until refreshed,
without extending access past a known provider boundary.

## Repository structure

```text
app/                    Next.js pages, layouts, and route handlers
components/             Shared visual components
database/               Ordered table-by-table Supabase SQL source
lib/auth/               Session and identity helpers
lib/permissions/        Owner/staff authorization checks
lib/supabase/           Browser, user-scoped server, and elevated clients
lib/modules/            Organization, team, equipment, ticket, and other domains
lib/providers/          Lemon Squeezy adapter
lib/jobs/               Billing synchronization and reconciliation logic
netlify/functions/      Scheduled billing worker entry point
supabase/migrations/    Deployable chronological migrations
tests/                  Permissions, workflows, billing, recovery, E2E, and load tests
scripts/                Backup and restore tools
docs/architecture/      Architecture documentation
```

See [`docs/architecture/folder-structure.md`](docs/architecture/folder-structure.md)
for the detailed module and route map.

## Database

The [`database/`](database/) directory contains ordered SQL definitions for all
18 launch tables plus authorization helpers, integrity triggers, RLS policies,
and private Storage configuration.

For a new Supabase environment, run SQL files in filename order. Table files
`010`–`180` are one-time schema creation files. Files `800`, `810`, `900`, and
`910` apply security and operational behavior; the trigger and policy files are
safe to rerun where documented.

Do not edit an already-applied production migration. Add a new chronological
migration for every later schema change.

## Local configuration

Copy `.env.example` to `.env.local` and provide the local values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
APP_URL=http://localhost:3000
SUPABASE_PROJECT_REF=
SUPABASE_SECRET_KEY=
```

`NEXT_PUBLIC_*` values are browser-safe identifiers. `SUPABASE_SECRET_KEY`
bypasses RLS and is server-only. Never prefix a secret with `NEXT_PUBLIC_`.

Supabase Auth currently uses Google OAuth. Configure the Google provider in the
Supabase dashboard and use this provider callback pattern:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

For local application redirects, configure:

```text
Site URL:     http://localhost:3000
Redirect URL: http://localhost:3000/**
```

Production must later use the exact HTTPS application URL, with separately
controlled Netlify preview redirects.

## Run locally

Requirements:

- a supported Node.js release;
- npm;
- a configured Supabase project; and
- the local environment values above.

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Project checks:

```bash
npm run lint
npm run build
```

The final application should self-host its font or use a system font so builds
do not depend on downloading Google Fonts.

## Development sequence

Work follows security and dependency order:

1. Google authentication, session handling, and protected routes.
2. Atomic organization creation, owner membership, invitations, and tenant
   isolation tests.
3. Equipment management and printable QR codes.
4. Idempotent fault reporting, tickets, and private attachments.
5. Repair workflow, owner-only costs, menu impact, and Today summary.
6. Lemon Squeezy checkout, verified webhooks, jobs, and reconciliation.
7. First-use guidance, export/recovery, responsive polish, and release checks.

Do not begin detailed marketing-page work before authentication, tenant
isolation, and the core reporting workflow are demonstrated.

## Current implementation status

- [x] Next.js and TypeScript project initialized.
- [x] Module-oriented repository structure created.
- [x] All 18 launch database tables defined and applied.
- [x] Authorization helpers, integrity triggers, RLS policies, and private
      Storage definition created and applied.
- [x] Supabase project, local URL configuration, and Google provider configured.
- [ ] Google sign-in UI, OAuth callback, session handling, and logout.
- [ ] Atomic organization/team functions and cross-tenant tests.
- [ ] Equipment, QR reporting, tickets, repairs, menu impact, and Today UI.
- [ ] Billing integration and scheduled reconciliation worker.
- [ ] Recovery drill, performance tests, and production release gates.

## Launch release gates

The pilot must not launch until the applicable gates pass, including:

- owner and staff workflows work on mobile and desktop;
- two businesses cannot access each other's records or photos;
- staff cannot read costs or billing, manage roles, or verify repairs;
- duplicate submissions create one ticket;
- concurrent edits return a conflict rather than losing data;
- failed photo uploads preserve the text report;
- invalid and duplicate billing webhooks are safely rejected or deduplicated;
- checkout redirects alone never grant paid access;
- backup and private-object restore procedures are exercised;
- no production secrets appear in client bundles, logs, or Git; and
- no unresolved tenant-leak, billing-integrity, or data-loss defect remains.

## Launch scope exclusions

The initial pilot intentionally excludes AI assistants, voice transcription,
WhatsApp, external technician accounts, multi-location billing, inventory,
purchase orders, POS integrations, estimated lost revenue, offline sync, push
notifications, live collaboration, advanced charts, and bulk imports.

## Governing documents

Product scope and technical decisions are defined by the workspace documents:

- `01-RepairLog-Launch-Plan.md`
- `02-RepairLog-System-Design.md`
- `03-RepairLog-Providers-Costs-Credentials.md`

When implementation details conflict with those documents, resolve the
conflict explicitly rather than silently expanding the launch scope.
