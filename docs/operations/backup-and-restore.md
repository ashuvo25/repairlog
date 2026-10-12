# Backup and restore

RepairLog keeps data in two places, and each needs its own backup:

| What | Where | Covered by |
| --- | --- | --- |
| Records (cafés, equipment, tickets, costs, billing) | Supabase Postgres | Database backup |
| Photos | Supabase Storage bucket `repair-photos` | `scripts/backup/backup-photos.mjs` |

A Supabase database backup does **not** contain photo bytes.

## Routine backup

1. **Database.** On Supabase Pro, daily backups run automatically
   (Dashboard → Database → Backups). On the Free plan there are none, so take
   one yourself at least weekly:
   ```bash
   pg_dump "$DATABASE_URL" --format=custom --no-owner --file repairlog-YYYY-MM-DD.dump
   ```
2. **Photos.** From the `repairlog` folder:
   ```bash
   node scripts/backup/backup-photos.mjs
   ```
   This writes `backups/photos-<timestamp>/` with every photo and a
   `manifest.json` of sizes and SHA-256 checksums. `backups/` is git-ignored
   because it contains customer data.
3. Copy both outputs to storage outside Supabase (an encrypted drive or a
   private cloud folder). Keep at least the last four weeks.

## Restore exercise (release gate)

Do this against a **separate** Supabase project, never production.

1. Create a new Supabase project.
2. Restore the database:
   ```bash
   pg_restore --dbname "$RESTORE_DATABASE_URL" --no-owner --clean --if-exists repairlog-YYYY-MM-DD.dump
   ```
   Or, from an empty project, run every file in `database/` in order and then
   restore data only with `pg_restore --data-only`.
3. Restore photos:
   ```bash
   RESTORE_SUPABASE_URL=https://<restore-ref>.supabase.co \
   RESTORE_SUPABASE_SECRET_KEY=<restore secret key> \
   node scripts/restore/restore-photos.mjs backups/photos-<timestamp>
   ```
   The script checks every file against its checksum before uploading.
4. Point a local copy of the app at the restore project (`.env.local`) and
   check: a café opens, a ticket shows its photos, the cost totals match the
   CSV export taken before the backup.
5. Record the date, backup used and result in the pilot log.

## Rolling back the application

Netlify keeps every deploy. Deploys → choose the previous one → "Publish
deploy". Database changes are forward-only: add a new SQL file to undo a
change rather than editing one that has already run.
