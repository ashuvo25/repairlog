// Copies every stored photo to a local folder. Supabase database backups do
// not include storage object bytes, so photos need their own backup.
//
// Usage (from the repairlog folder):
//   node scripts/backup/backup-photos.mjs [output-folder]
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment
// or from .env.local. Writes photos plus a manifest.json with sizes and
// SHA-256 checksums, so a restore can be verified.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BUCKET = "repair-photos";
const PAGE = 100;

function loadEnv() {
  const env = { ...process.env };
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && env[match[1]] === undefined) env[match[1]] = match[2].trim();
    }
  }
  return env;
}

const env = loadEnv();
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;

if (!baseUrl || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  process.exit(1);
}

const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  // Supabase rejects secret keys from anything that looks like a browser.
  "User-Agent": "repairlog-backup/1.0",
};

async function list(prefix) {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const response = await fetch(`${baseUrl}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!response.ok) throw new Error(`List failed for "${prefix}": ${response.status}`);
    const entries = await response.json();
    for (const entry of entries) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have no id; walk into them.
      if (entry.id === null) files.push(...(await list(fullPath)));
      else files.push(fullPath);
    }
    if (entries.length < PAGE) return files;
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.resolve(process.argv[2] ?? path.join("backups", `photos-${stamp}`));
await mkdir(outDir, { recursive: true });

const paths = await list("");
const manifest = { bucket: BUCKET, createdAt: new Date().toISOString(), files: [] };

for (const objectPath of paths) {
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${BUCKET}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
    { headers },
  );
  if (!response.ok) throw new Error(`Download failed for ${objectPath}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const target = path.join(outDir, ...objectPath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  manifest.files.push({
    path: objectPath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Backed up ${manifest.files.length} photos to ${outDir}`);
