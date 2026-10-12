import {
  MAX_EVENT_ATTEMPTS,
  processBillingEvent,
  syncSubscription,
} from "@/lib/modules/billing/sync";
import { getLemonSqueezyConfig } from "@/lib/providers/lemonsqueezy/config";
import { createAdminClient } from "@/lib/supabase/admin/client";

const EVENT_BATCH = 20;
const RECONCILE_BATCH = 10;
const RECONCILE_AFTER_MS = 12 * 60 * 60 * 1000;
const RUN_DEADLINE_MS = 20_000;

export type BillingRunResult = {
  eventsRetried: number;
  eventsStillFailing: number;
  subscriptionsReconciled: number;
  reconcileErrors: number;
};

// One bounded pass: retry events that failed or never finished, then refresh
// subscriptions that have not been checked against the provider recently.
export async function runBillingJobs(): Promise<BillingRunResult> {
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > RUN_DEADLINE_MS;
  const admin = createAdminClient();
  const config = getLemonSqueezyConfig();
  const result: BillingRunResult = {
    eventsRetried: 0,
    eventsStillFailing: 0,
    subscriptionsReconciled: 0,
    reconcileErrors: 0,
  };

  const { data: events, error: eventsError } = await admin
    .from("billing_events")
    .select("id, payload, processing_attempts")
    .eq("provider_environment", config.environment)
    .in("processing_state", ["pending", "failed"])
    .lt("processing_attempts", MAX_EVENT_ATTEMPTS)
    .order("received_at", { ascending: true })
    .limit(EVENT_BATCH);

  if (eventsError) {
    throw new Error(`Billing events could not be read: ${eventsError.message}`);
  }

  for (const event of events ?? []) {
    if (outOfTime()) {
      return result;
    }

    result.eventsRetried += 1;
    if ((await processBillingEvent(admin, event)) === "failed") {
      result.eventsStillFailing += 1;
    }
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("billing_subscriptions")
    .select("provider_subscription_id")
    .eq("provider_environment", config.environment)
    .eq("provider_store_id", config.storeId)
    .neq("status", "expired")
    .lt("synced_at", new Date(Date.now() - RECONCILE_AFTER_MS).toISOString())
    .order("synced_at", { ascending: true })
    .limit(RECONCILE_BATCH);

  if (subscriptionsError) {
    throw new Error(
      `Subscriptions could not be read: ${subscriptionsError.message}`,
    );
  }

  for (const subscription of subscriptions ?? []) {
    if (outOfTime()) {
      return result;
    }

    try {
      await syncSubscription(admin, subscription.provider_subscription_id);
      result.subscriptionsReconciled += 1;
    } catch (error) {
      result.reconcileErrors += 1;
      console.error("Subscription reconciliation failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}
