import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getSubscription,
  getSubscriptionInvoice,
  LemonSqueezyError,
  type ProviderSubscription,
} from "@/lib/providers/lemonsqueezy/client";
import {
  getLemonSqueezyConfig,
  planForVariant,
  type LemonSqueezyConfig,
} from "@/lib/providers/lemonsqueezy/config";

const SUBSCRIPTION_STATUSES = [
  "on_trial",
  "active",
  "cancelled",
  "past_due",
  "unpaid",
  "expired",
  "paused",
] as const;

export const MAX_EVENT_ATTEMPTS = 8;

export type BillingEventRow = {
  id: string;
  payload: unknown;
  processing_attempts: number;
};

type Outcome =
  | { state: "processed"; organizationId: string }
  | { state: "ignored"; reason: string };

export function hashBinding(binding: string) {
  // PostgREST accepts bytea as a \x-prefixed hex string.
  return `\\x${createHash("sha256").update(binding, "utf8").digest("hex")}`;
}

function readEvent(payload: unknown) {
  const body = (payload ?? {}) as {
    meta?: { event_name?: unknown; custom_data?: { binding?: unknown } };
    data?: { type?: unknown; id?: unknown; attributes?: Record<string, unknown> };
  };
  const binding = body.meta?.custom_data?.binding;

  return {
    eventName: typeof body.meta?.event_name === "string" ? body.meta.event_name : "",
    resourceType: typeof body.data?.type === "string" ? body.data.type : "",
    resourceId:
      typeof body.data?.id === "string" || typeof body.data?.id === "number"
        ? String(body.data.id)
        : "",
    attributes: body.data?.attributes ?? {},
    binding: typeof binding === "string" ? binding : null,
  };
}

// Finds the café a subscription belongs to: an existing record first, then
// the checkout binding carried in the signed webhook. Customer email is never
// used to link a payment to a café.
async function resolveOrganization(
  admin: SupabaseClient,
  config: LemonSqueezyConfig,
  subscription: ProviderSubscription,
  binding: string | null,
) {
  const { data: existing, error: existingError } = await admin
    .from("billing_subscriptions")
    .select("organization_id, checkout_attempt_id")
    .eq("provider_environment", config.environment)
    .eq("provider_store_id", config.storeId)
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Subscription lookup failed: ${existingError.message}`);
  }

  if (existing) {
    return {
      organizationId: existing.organization_id as string,
      checkoutAttemptId: existing.checkout_attempt_id as string | null,
    };
  }

  if (!binding) {
    return null;
  }

  const { data: attempt, error: attemptError } = await admin
    .from("billing_checkout_attempts")
    .select("id, organization_id, provider_variant_id, status")
    .eq("binding_token_hash", hashBinding(binding))
    .eq("provider_environment", config.environment)
    .eq("provider_store_id", config.storeId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Checkout lookup failed: ${attemptError.message}`);
  }

  if (!attempt || attempt.provider_variant_id !== subscription.variantId) {
    return null;
  }

  if (attempt.status !== "matched") {
    const { error } = await admin
      .from("billing_checkout_attempts")
      .update({ status: "matched", matched_at: new Date().toISOString() })
      .eq("id", attempt.id);

    if (error) {
      throw new Error(`Checkout match failed: ${error.message}`);
    }
  }

  return {
    organizationId: attempt.organization_id as string,
    checkoutAttemptId: attempt.id as string,
  };
}

async function saveSubscription(
  admin: SupabaseClient,
  config: LemonSqueezyConfig,
  subscription: ProviderSubscription,
  organizationId: string,
  checkoutAttemptId: string | null,
) {
  if (
    !SUBSCRIPTION_STATUSES.includes(
      subscription.status as (typeof SUBSCRIPTION_STATUSES)[number],
    )
  ) {
    throw new Error(`Unknown subscription status: ${subscription.status}`);
  }

  const key = {
    provider_environment: config.environment,
    provider_store_id: config.storeId,
    provider_subscription_id: subscription.id,
  };
  const { data: existing, error: readError } = await admin
    .from("billing_subscriptions")
    .select("id, provider_updated_at, cancelled_at, paused_at")
    .match(key)
    .maybeSingle();

  if (readError) {
    throw new Error(`Subscription read failed: ${readError.message}`);
  }

  const now = new Date().toISOString();
  const fields = {
    provider_customer_id: subscription.customerId,
    provider_order_id: subscription.orderId,
    provider_product_id: subscription.productId,
    provider_variant_id: subscription.variantId,
    status: subscription.status,
    provider_created_at: subscription.createdAt,
    trial_ends_at: subscription.trialEndsAt,
    renews_at: subscription.renewsAt,
    ends_at: subscription.endsAt,
    // The provider reports these as flags, so the first time each is seen is
    // recorded using the provider's own update time.
    cancelled_at: subscription.cancelled
      ? (existing?.cancelled_at ?? subscription.updatedAt)
      : null,
    paused_at: subscription.paused
      ? (existing?.paused_at ?? subscription.updatedAt)
      : null,
    provider_updated_at: subscription.updatedAt,
    synced_at: now,
    raw_provider_fields: subscription.display,
  };

  if (!existing) {
    const { error } = await admin.from("billing_subscriptions").insert({
      ...key,
      ...fields,
      organization_id: organizationId,
      checkout_attempt_id: checkoutAttemptId,
    });

    // 23505: a concurrent delivery inserted it first; the retry will update.
    if (error) {
      throw new Error(`Subscription insert failed: ${error.message}`);
    }

    return;
  }

  // A delayed, older event must not overwrite newer provider data. The
  // filter makes that check atomic with the write.
  const { error } = await admin
    .from("billing_subscriptions")
    .update(fields)
    .eq("id", existing.id)
    .lte("provider_updated_at", subscription.updatedAt);

  if (error) {
    throw new Error(`Subscription update failed: ${error.message}`);
  }

  // Stale or not, the record was just confirmed against the provider.
  await admin
    .from("billing_subscriptions")
    .update({ synced_at: now })
    .eq("id", existing.id);
}

async function saveInvoice(
  admin: SupabaseClient,
  config: LemonSqueezyConfig,
  invoiceId: string,
  organizationId: string,
  subscriptionId: string,
) {
  const invoice = await getSubscriptionInvoice(invoiceId, config);

  if (invoice.storeId !== config.storeId || invoice.subscriptionId !== subscriptionId) {
    return;
  }

  const { data: subscriptionRow } = await admin
    .from("billing_subscriptions")
    .select("id")
    .eq("provider_environment", config.environment)
    .eq("provider_store_id", config.storeId)
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();

  const { error } = await admin.from("billing_invoices").upsert(
    {
      organization_id: organizationId,
      billing_subscription_id: subscriptionRow?.id ?? null,
      provider_environment: config.environment,
      provider_store_id: config.storeId,
      provider_invoice_id: invoice.id,
      status: invoice.status,
      subtotal_minor: invoice.subtotalMinor,
      discount_minor: invoice.discountMinor,
      tax_minor: invoice.taxMinor,
      total_minor: invoice.totalMinor,
      currency: invoice.currency,
      issued_at: invoice.createdAt || null,
      refunded_at: invoice.refundedAt,
      provider_updated_at: invoice.updatedAt,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "provider_environment,provider_store_id,provider_invoice_id" },
  );

  if (error) {
    throw new Error(`Invoice save failed: ${error.message}`);
  }
}

// Fetches the current record from Lemon Squeezy and stores it. The webhook
// body only says which subscription changed; its field values are not used.
export async function syncSubscription(
  admin: SupabaseClient,
  subscriptionId: string,
  options: { binding?: string | null; invoiceId?: string | null } = {},
  config = getLemonSqueezyConfig(),
): Promise<Outcome> {
  const subscription = await getSubscription(subscriptionId, config);

  if (subscription.storeId !== config.storeId) {
    return { state: "ignored", reason: "different store" };
  }

  if (subscription.testMode !== config.testMode) {
    return { state: "ignored", reason: "different environment" };
  }

  // The store is shared with other products; only RepairLog plans count.
  if (!planForVariant(config, subscription.variantId)) {
    return { state: "ignored", reason: "not a RepairLog plan" };
  }

  const owner = await resolveOrganization(
    admin,
    config,
    subscription,
    options.binding ?? null,
  );

  if (!owner) {
    throw new Error("No checkout binding links this subscription to a café.");
  }

  await saveSubscription(
    admin,
    config,
    subscription,
    owner.organizationId,
    owner.checkoutAttemptId,
  );

  if (options.invoiceId) {
    await saveInvoice(
      admin,
      config,
      options.invoiceId,
      owner.organizationId,
      subscription.id,
    );
  }

  return { state: "processed", organizationId: owner.organizationId };
}

async function handleEvent(admin: SupabaseClient, payload: unknown): Promise<Outcome> {
  const event = readEvent(payload);

  if (event.resourceType === "subscriptions" && event.resourceId) {
    return syncSubscription(admin, event.resourceId, { binding: event.binding });
  }

  if (event.resourceType === "subscription-invoices" && event.resourceId) {
    const subscriptionId = event.attributes.subscription_id;

    if (typeof subscriptionId !== "number" && typeof subscriptionId !== "string") {
      return { state: "ignored", reason: "invoice without subscription" };
    }

    return syncSubscription(admin, String(subscriptionId), {
      binding: event.binding,
      invoiceId: event.resourceId,
    });
  }

  // Orders, disputes, licences and affiliates carry nothing access depends on.
  return { state: "ignored", reason: `unused event ${event.eventName}` };
}

// Processes one stored event and records the result on its row. Failures are
// kept for the scheduled worker to retry; they never throw to the caller.
export async function processBillingEvent(
  admin: SupabaseClient,
  event: BillingEventRow,
) {
  const attempts = event.processing_attempts + 1;

  try {
    const outcome = await handleEvent(admin, event.payload);

    await admin
      .from("billing_events")
      .update({
        processing_state: outcome.state,
        processing_attempts: attempts,
        processed_at: new Date().toISOString(),
        last_error: outcome.state === "ignored" ? outcome.reason : null,
        ...(outcome.state === "processed"
          ? { organization_id: outcome.organizationId }
          : {}),
      })
      .eq("id", event.id);

    return outcome.state;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const retryable = !(error instanceof LemonSqueezyError) || error.retryable;

    console.error("Billing event processing failed", {
      eventId: event.id,
      attempts,
      message,
    });

    await admin
      .from("billing_events")
      .update({
        processing_state: "failed",
        // A permanent provider answer (for example 404) is not retried.
        processing_attempts: retryable ? attempts : MAX_EVENT_ATTEMPTS,
        last_error: message.slice(0, 500),
      })
      .eq("id", event.id);

    return "failed" as const;
  }
}
