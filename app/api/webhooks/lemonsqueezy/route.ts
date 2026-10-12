import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { processBillingEvent } from "@/lib/modules/billing/sync";
import { verifyWebhookSignature } from "@/lib/providers/lemonsqueezy/client";
import {
  getLemonSqueezyConfig,
  isBillingConfigured,
} from "@/lib/providers/lemonsqueezy/config";
import { createAdminClient } from "@/lib/supabase/admin/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;

function reply(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  if (!isBillingConfigured()) {
    return reply(503, "Billing is not configured.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return reply(413, "Payload too large.");
  }

  // The signature covers the exact bytes sent, so verify before parsing.
  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.byteLength === 0 || rawBody.byteLength > MAX_BODY_BYTES) {
    return reply(413, "Payload too large.");
  }

  const config = getLemonSqueezyConfig();
  if (
    !verifyWebhookSignature(
      rawBody,
      request.headers.get("x-signature"),
      config.webhookSecret,
    )
  ) {
    return reply(401, "Invalid signature.");
  }

  const bodyText = Buffer.from(rawBody).toString("utf8");
  let payload: {
    meta?: { event_name?: unknown; test_mode?: unknown };
    data?: { type?: unknown; id?: unknown; attributes?: { store_id?: unknown } };
  };

  try {
    payload = JSON.parse(bodyText);
  } catch {
    return reply(400, "Invalid JSON.");
  }

  const eventType = payload.meta?.event_name;
  const resourceType = payload.data?.type;
  const resourceId = payload.data?.id;

  if (
    typeof eventType !== "string" ||
    typeof resourceType !== "string" ||
    (typeof resourceId !== "string" && typeof resourceId !== "number")
  ) {
    return reply(400, "Unrecognized event.");
  }

  // Events for another store or the other environment are acknowledged so
  // the provider stops retrying, but they are never stored or acted on.
  if (
    (payload.meta?.test_mode === true) !== config.testMode ||
    String(payload.data?.attributes?.store_id ?? "") !== config.storeId
  ) {
    return reply(200, "Ignored.");
  }

  const admin = createAdminClient();
  const dedupeKey = {
    provider_environment: config.environment,
    provider_store_id: config.storeId,
    event_type: eventType,
    resource_type: resourceType,
    resource_id: String(resourceId),
    payload_hash: createHash("sha256").update(rawBody).digest("hex"),
  };

  const inserted = await admin
    .from("billing_events")
    .insert({
      ...dedupeKey,
      payload,
      signature_verified_at: new Date().toISOString(),
    })
    .select("id, payload, processing_attempts")
    .single();

  let event = inserted.data;

  if (inserted.error) {
    // 23505: this exact delivery was stored before (a provider retry).
    if (inserted.error.code !== "23505") {
      console.error("Billing event could not be stored", {
        code: inserted.error.code,
      });
      // A non-2xx answer makes the provider deliver it again later.
      return reply(500, "Event could not be stored.");
    }

    const existing = await admin
      .from("billing_events")
      .select("id, payload, processing_attempts, processing_state")
      .match(dedupeKey)
      .single();

    if (existing.error || !existing.data) {
      return reply(500, "Event could not be read.");
    }

    if (
      existing.data.processing_state === "processed" ||
      existing.data.processing_state === "ignored"
    ) {
      return reply(200, "Already processed.");
    }

    event = existing.data;
  }

  if (!event) {
    return reply(500, "Event could not be stored.");
  }

  // The event is durable now. Processing failures are retried by the
  // scheduled worker, so the provider is acknowledged either way.
  await processBillingEvent(admin, event);

  return reply(200, "Received.");
}
