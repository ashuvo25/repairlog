# Database security tests

Run these tests against an isolated local Supabase database after applying the
RepairLog schema and functions:

```bash
supabase test db
```

Never run security fixtures against production. The tests use transactions and
synthetic identities, then roll all fixture data back.

`organization_creation.test.sql` exercises the complete atomic onboarding RPC,
including organization, location, owner membership, audit event, and retry
idempotency. It prevents SQL variable/column conflicts from reaching the UI.

`team_module.test.sql` covers invitation creation, the email-match rule,
single-use acceptance, staff denial, member removal and the immediate loss of
access that follows.

`equipment_module.test.sql` covers owner-only creation, idempotent retries,
version-checked edits, condition confirmation, QR-code rotation, archiving, and
staff mutation denial.
