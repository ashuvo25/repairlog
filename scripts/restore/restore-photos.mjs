// Uploads a photo backup made by scripts/backup/backup-photos.mjs into a
// Supabase project and verifies every file against the manifest checksums.
//
// Usage (from the repairlog folder):
//   RESTORE_SUPABASE_URL=https://<target>.supabase.co \
//   RESTORE_SUPABASE_SECRET_KEY=sb_secret_... \
//   node scripts/restore/restore-photos.mjs <backup-folder>
//
// The target is given explicitly so a restore can never overwrite production
// by accident. Existing objects are left untouched.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const BUCKET = "repair-photos";
const backupDir = process.argv[2];
const baseUrl = process.env.RESTORE_SUPABASE_URL;
const secretKey = process.env.RESTORE_SUPABASE_SECRET_KEY;

if (!backupDir || !baseUrl || !secretKey) {
  console.error("Usage: RESTORE_SUPABASE_URL=... RESTORE_SUPABASE_SECRET_KEY=... node scripts/restore/restore-photos.mjs <backup-folder>");
  process.exit(1);
}

const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  "User-Agent": "repairlog-restore/1.0",
};
const manifest = JSON.parse(await readFile(path.join(backupDir, "manifest.json"), "utf8"));
let restored = 0;
let skipped = 0;

for (const file of manifest.files) {
  const bytes = await readFile(path.join(backupDir, ...file.path.split("/")));
  if (createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
    throw new Error(`Backup file is corrupted: ${file.path}`);
  }
  const url = `${baseUrl}/storage/v1/object/${BUCKET}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "image/jpeg", "x-upsert": "false" },
    body: bytes,
  });
  if (response.ok) restored += 1;
  else if (response.status === 409 || response.status === 400) skipped += 1;
  else throw new Error(`Upload failed for ${file.path}: ${response.status}`);
}

console.log(`Restored ${restored} photos, ${skipped} already present, from ${manifest.files.length} in the backup.`);
