"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppUrl } from "@/lib/auth/app-url";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  getEntitlement,
  pickCurrentSubscription,
  type SubscriptionProjection,
} from "@/lib/modules/billing/entitlement";
import { hashBinding, syncSubscription } from "@/lib/modules/billing/sync";
import {
  createCheckout,
  getSubscription,
} from "@/lib/providers/lemonsqueezy/client";
import {
  getLemonSqueezyConfig,
  isBillingConfigured,
  type BillingPlan,
} from "@/lib/providers/lemonsqueezy/config";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createAdminClient } from "@/lib/supabase/admin/client";
import { createClient } from "@/lib/supabase/server/client";

export type BillingActionState = {
  error?: string;
  success?: string;
};

const CHECKOUT_LIFETIME_MS = 2 * 60 * 60 * 1000;
const NOT_CONFIGURED = "Billing is not available yet. Please try again later.";
const PROVIDER_DOWN =
  "We could not reach the payment provider. Please try again in a moment.";

async function readCurrentSubscription(organizationId: string) {
  const config = getLemonSqueezyConfig();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select(
      "status, provider_variant_id, provider_subscription_id, trial_ends_at, renews_at, ends_at, synced_at",
    )
    .eq("organization_id", organizationId)
    .eq("provider_environment", config.environment);

  if (error) {
    throw new Error("Unable to read the subscription.");
  }

  return pickCurrentSubscription((data ?? []) as SubscriptionProjection[]);
}

export async function startCheckout(
  _state: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const membership = await requireOwner();
  const user = await requireAuthenticatedUser();
  const plan = formData.get("plan")?.toString();

  if (!isBillingConfigured()) {
    return { error: NOT_CONFIGURED };
  }

  // The browser only names a plan; the product comes from server settings.
  if (plan !== "monthly" && plan !== "yearly") {
    return { error: "Choose a plan to continue." };
  }

  const current = await readCurrentSubscription(membership.organizationId);
  if (current && current.status !== "expired") {
    return {
      error:
        "This café already has a subscription. Use Manage billing to change it.",
    };
  }

  const config = getLemonSqueezyConfig();
  const variantId = config.variants[plan as BillingPlan];
  const binding = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CHECKOUT_LIFETIME_MS).toISOString();
  const admin = createAdminClient();

  const { data: attempt, error: attemptError } = await admin
    .from("billing_checkout_attempts")
    .insert({
      organization_id: membership.organizationId,
      created_by: membership.userId,
      binding_token_hash: hashBinding(binding),
      provider_store_id: config.storeId,
      provider_variant_id: variantId,
      provider_environment: config.environment,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (attemptError || !attempt) {
    console.error("Checkout attempt could not be stored", {
      code: attemptError?.code,
    });
    return { error: "We could not start the checkout. Please try again." };
  }

  let checkoutUrl: string;

  try {
    const returnUrl = new URL("/settings/billing", getAppUrl());
    returnUrl.searchParams.set("checkout", "return");

    const checkout = await createCheckout(
      {
        variantId,
        email: user.email,
        binding,
        redirectUrl: returnUrl.toString(),
        expiresAt,
      },
      config,
    );

    await admin
      .from("billing_checkout_attempts")
      .update({ provider_checkout_id: checkout.id, status: "redirected" })
      .eq("id", attempt.id);

    checkoutUrl = checkout.url;
  } catch (error) {
    console.error("Checkout creation failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    await admin
      .from("billing_checkout_attempts")
      .update({ status: "failed" })
      .eq("id", attempt.id);
    return { error: PROVIDER_DOWN };
  }

  redirect(checkoutUrl);
}

export async function openBillingPortal(): Promise<BillingActionState> {
  const membership = await requireOwner();

  if (!isBillingConfigured()) {
    return { error: NOT_CONFIGURED };
  }

  const current = await readCurrentSubscription(membership.organizationId);
  if (!current) {
    return { error: "This café does not have a subscription yet." };
  }

  let portalUrl: string | null;

  try {
    // Portal links are signed and short-lived, so one is fetched per click.
    const subscription = await getSubscription(current.provider_subscription_id);
    portalUrl = subscription.customerPortalUrl;
  } catch {
    return { error: PROVIDER_DOWN };
  }

  if (!portalUrl) {
    return { error: "The billing portal is not available for this subscription." };
  }

  redirect(portalUrl);
}

export async function refreshSubscription(): Promise<BillingActionState> {
  const membership = await requireOwner();

  if (!isBillingConfigured()) {
    return { error: NOT_CONFIGURED };
  }

  const current = await readCurrentSubscription(membership.organizationId);
  if (!current) {
    return { error: "No subscription has been confirmed for this café yet." };
  }

  try {
    await syncSubscription(createAdminClient(), current.provider_subscription_id);
  } catch (error) {
    console.error("Manual subscription refresh failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { error: PROVIDER_DOWN };
  }

  revalidatePath("/settings/billing");
  const refreshed = await readCurrentSubscription(membership.organizationId);

  return {
    success: getEntitlement(refreshed).entitled
      ? "Subscription status is up to date."
      : "Status refreshed.",
  };
}
