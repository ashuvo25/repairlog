import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getEntitlement,
  pickCurrentSubscription,
  type SubscriptionProjection,
} from "@/lib/modules/billing/entitlement";

// Every new café gets this long to try RepairLog before choosing a plan.
export const TRIAL_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

export type CafeAccess =
  | { state: "subscribed"; subscription: SubscriptionProjection }
  | { state: "trial"; trialEndsAt: Date; daysLeft: number }
  | { state: "expired"; trialEndedAt: Date };

// A paid status keeps access even if the local copy is a little out of date;
// the scheduled worker refreshes it. Only an ended or unpaid subscription,
// or none at all after the trial, pauses public QR reporting.
function isPaid(subscription: SubscriptionProjection | null) {
  if (!subscription) {
    return false;
  }

  const entitlement = getEntitlement(subscription);

  return (
    entitlement.entitled ||
    (entitlement.stale &&
      ["active", "on_trial", "past_due"].includes(subscription.status))
  );
}

export function computeCafeAccess(
  organizationCreatedAt: string,
  subscriptions: readonly SubscriptionProjection[],
  now = Date.now(),
): CafeAccess {
  const subscription = pickCurrentSubscription(subscriptions);

  if (subscription && isPaid(subscription)) {
    return { state: "subscribed", subscription };
  }

  const trialEndsAt = new Date(new Date(organizationCreatedAt).getTime() + TRIAL_DAYS * DAY_MS);

  if (trialEndsAt.getTime() > now) {
    return {
      state: "trial",
      trialEndsAt,
      daysLeft: Math.max(1, Math.ceil((trialEndsAt.getTime() - now) / DAY_MS)),
    };
  }

  return { state: "expired", trialEndedAt: trialEndsAt };
}

// Works with either a signed-in owner's client (row-level security limits
// it to their café) or the server's admin client for public pages.
export async function loadCafeAccess(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CafeAccess> {
  const [organizationResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("created_at")
      .eq("id", organizationId)
      .single(),
    supabase
      .from("billing_subscriptions")
      .select(
        "status, provider_variant_id, provider_subscription_id, trial_ends_at, renews_at, ends_at, synced_at",
      )
      .eq("organization_id", organizationId)
      // Test-mode subscriptions never unlock a live site, and vice versa.
      .eq(
        "provider_environment",
        process.env.LEMONSQUEEZY_TEST_MODE?.trim() === "false" ? "live" : "test",
      ),
  ]);

  if (organizationResult.error || !organizationResult.data) {
    throw new Error("Unable to check the café's plan.");
  }

  return computeCafeAccess(
    organizationResult.data.created_at as string,
    (subscriptionsResult.data ?? []) as SubscriptionProjection[],
  );
}

// For public QR pages: finds the café behind a reporting code and checks
// whether it may currently receive reports.
export async function loadAccessForReportCode(
  admin: SupabaseClient,
  publicReportCode: string,
): Promise<CafeAccess | null> {
  const { data } = await admin
    .from("equipment")
    .select("organization_id")
    .eq("public_report_code", publicReportCode)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return loadCafeAccess(admin, data.organization_id as string);
}
