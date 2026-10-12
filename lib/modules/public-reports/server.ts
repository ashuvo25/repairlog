import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import sharp from "sharp";

export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_PHOTOS = 2;
// What the browser may send. Photos are compressed on the device first, so
// anything larger than this is not a normal submission.
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_STORED_BYTES = 1024 * 1024;
const MAX_EDGE = 1600;

// A salted, daily-rotating hash of the visitor's network address. It lets the
// database rate-limit a device without the address ever being stored.
export function getReporterFingerprint(headers: Headers) {
  const secret = process.env.PUBLIC_REPORT_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: PUBLIC_REPORT_SECRET");
  }

  const address =
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  const day = new Date().toISOString().slice(0, 10);

  return createHmac("sha256", secret).update(`${day}:${address}`).digest("hex");
}

export function isTurnstileEnabled() {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
}

export async function verifyTurnstile(token: string | null) {
  if (!isTurnstileEnabled()) {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY ?? "",
          response: token,
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    const result = (await response.json()) as { success?: boolean };

    return result.success === true;
  } catch {
    // If the check cannot run, refuse rather than let unverified traffic in.
    return false;
  }
}

// Compares an upload token with the hash stored on the report. PostgREST
// returns bytea as a \x-prefixed hex string.
export function uploadTokenMatches(token: string, storedHash: string) {
  if (!/^[0-9a-f]{64}$/.test(token) || !/^\\x[0-9a-f]{64}$/.test(storedHash)) {
    return false;
  }

  const expected = Buffer.from(storedHash.slice(2), "hex");
  const received = createHash("sha256").update(Buffer.from(token, "hex")).digest();

  return timingSafeEqual(expected, received);
}

export type ProcessedPhoto = {
  data: Buffer;
  width: number;
  height: number;
};

// Decodes the upload with a real image parser (the declared type is not
// trusted), applies its rotation, shrinks it and re-encodes it as JPEG.
// Re-encoding drops location, device and every other embedded metadata.
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto | null> {
  try {
    const metadata = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();

    if (!["jpeg", "png", "webp", "heif"].includes(metadata.format ?? "")) {
      return null;
    }

    for (const quality of [78, 62, 45]) {
      const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      if (data.byteLength <= MAX_STORED_BYTES) {
        return { data, width: info.width, height: info.height };
      }
    }

    return null;
  } catch {
    return null;
  }
}
