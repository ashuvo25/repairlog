import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, cardClasses } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { CheckIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { computeCafeAccess, TRIAL_DAYS } from "@/lib/modules/billing/access";
import {
  getEntitlement,
  pickCurrentSubscription,
  type SubscriptionProjection,
  type SubscriptionStatus,
} from "@/lib/modules/billing/entitlement";
import {
  getVariantPrice,
  type ProviderVariantPrice,
} from "@/lib/providers/lemonsqueezy/client";
import {
  getLemonSqueezyConfig,
  isBillingConfigured,
  planForVariant,
  type BillingPlan,
} from "@/lib/providers/lemonsqueezy/config";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import {
  CheckoutPending,
  AutoRenewControl,
  ManageBillingButton,
  RefreshStatusButton,
  SubscribeButton,
} from "./billing-ui";

export const metadata: Metadata = {
  title: "Billing",
};

type SubscriptionRow = SubscriptionProjection & {
  raw_provider_fields: {
    cardBrand?: string | null;
    cardLastFour?: string | null;
  } | null;
};

const STATUS_LABELS: Record<
  SubscriptionStatus,
  { label: string; tone: "positive" | "attention" | "danger" | "neutral" }
> = {
  active: { label: "Active", tone: "positive" },
  on_trial: { label: "Free trial", tone: "positive" },
  past_due: { label: "Payment failed", tone: "attention" },
  cancelled: { label: "Cancelled", tone: "attention" },
  paused: { label: "Paused", tone: "neutral" },
  unpaid: { label: "Unpaid", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
};

const PLAN_NAMES: Record<BillingPlan, string> = {
  monthly: "Monthly plan",
  yearly: "Yearly plan",
};

const INCLUDED = [
  "One café location",
  "Up to 10 staff members",
  "A printable QR label for every machine",
  "Owner-confirmed equipment condition",
] as const;

function isInFuture(value: string) {
  return new Date(value).getTime() > Date.now();
}

function formatPrice(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

// One sentence, built only from dates the provider reported.
function describe(subscription: SubscriptionRow, timezone: string) {
  const date = (value: string | null) =>
    value ? formatDate(value, timezone) : null;

  switch (subscription.status) {
    case "on_trial":
      return date(subscription.trial_ends_at)
        ? `Your free trial ends on ${date(subscription.trial_ends_at)}.`
        : "Your free trial is running.";
    case "active":
      return date(subscription.renews_at)
        ? `Renews automatically on ${date(subscription.renews_at)}.`
        : "Your subscription is active.";
    case "past_due":
      return "The last payment failed. The provider will retry; update your payment method to avoid losing access.";
    case "cancelled":
      return date(subscription.ends_at)
        ? `Cancelled. Access continues until ${date(subscription.ends_at)}.`
        : "This subscription was cancelled.";
    case "paused":
      return "Payments are paused. You can resume from Manage billing.";
    case "unpaid":
      return "Payment could not be collected. Update your payment method to restore access.";
    case "expired":
      return date(subscription.ends_at)
        ? `This subscription ended on ${date(subscription.ends_at)}.`
        : "This subscription has ended.";
  }
}

function PlanCard({
  plan,
  price,
  highlighted,
}: Readonly<{
  plan: BillingPlan;
  price: ProviderVariantPrice;
  highlighted: boolean;
}>) {
  const interval = plan === "monthly" ? "month" : "year";

  return (
    <div
      className={`${cardClasses} flex flex-col p-5 ${highlighted ? "border-primary" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{PLAN_NAMES[plan]}</h3>
        {highlighted ? <Badge tone="positive">Best value</Badge> : null}
      </div>
      <p className="mt-3">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatPrice(price.priceMinor)}
        </span>
        <span className="text-sm text-muted"> / {interval}</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        {price.hasFreeTrial && price.trialDays
          ? `${price.trialDays}-day free trial, then billed every ${interval}.`
          : `Billed every ${interval}. Cancel any time.`}
      </p>
      <div className="mt-5">
        <SubscribeButton
          plan={plan}
          label={`Choose ${interval}ly`}
          variant={highlighted ? "primary" : "secondary"}
        />
      </div>
    </div>
  );
}

export default async function BillingSettingsPage({
  searchParams,
}: PageProps<"/settings/billing">) {
  const membership = await requireOwner();
  const returnedFromCheckout = (await searchParams).checkout === "return";

  if (!isBillingConfigured()) {
    return (
      <FormMessage tone="error">
        Billing is not available yet. Your café can keep using RepairLog.
      </FormMessage>
    );
  }

  const config = getLemonSqueezyConfig();
  const supabase = await createClient();
  const [organizationResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("timezone, created_at")
      .eq("id", membership.organizationId)
      .single(),
    supabase
      .from("billing_subscriptions")
      .select(
        "status, provider_variant_id, provider_subscription_id, trial_ends_at, renews_at, ends_at, synced_at, raw_provider_fields",
      )
      .eq("organization_id", membership.organizationId)
      .eq("provider_environment", config.environment),
  ]);

  if (subscriptionsResult.error) {
    throw new Error("Unable to load billing.");
  }

  const timezone: string = organizationResult.data?.timezone ?? "UTC";
  const subscription = pickCurrentSubscription(
    (subscriptionsResult.data ?? []) as SubscriptionRow[],
  );
  const canSubscribe = !subscription || subscription.status === "expired";
  const access = organizationResult.data?.created_at
    ? computeCafeAccess(
        organizationResult.data.created_at as string,
        (subscriptionsResult.data ?? []) as SubscriptionRow[],
      )
    : null;
  const trialNotice =
    access?.state === "trial" ? (
      <Card title={`Free trial: ${access.daysLeft === 1 ? "last day" : `${access.daysLeft} days left`}`}>
        <p className="leading-7 text-muted">
          Every café gets {TRIAL_DAYS} days free with everything included. Your
          trial ends on {formatDate(access.trialEndsAt, timezone)}. Choose a
          plan any time; you are only charged once you subscribe.
        </p>
      </Card>
    ) : access?.state === "expired" ? (
      <div
        role="status"
        className="rounded-lg border border-attention-border bg-attention-soft px-5 py-4 text-attention"
      >
        <p className="font-semibold">
          Your free trial ended on {formatDate(access.trialEndedAt, timezone)}.
        </p>
        <p className="mt-1 text-sm leading-6">
          Customers can&apos;t report faults by QR code until you choose a
          plan. Your team can keep using everything else.
        </p>
      </div>
    ) : null;

  const testModeNotice = config.testMode ? (
    <p className="rounded-lg border border-border bg-subtle px-4 py-3 text-sm leading-6 text-muted">
      <span className="font-semibold text-foreground">Test mode.</span> No real
      money is charged. Use the provider&apos;s test card at checkout.
    </p>
  ) : null;

  let prices: Record<BillingPlan, ProviderVariantPrice> | null = null;
  if (canSubscribe) {
    try {
      const [monthly, yearly] = await Promise.all([
        getVariantPrice(config.variants.monthly, config),
        getVariantPrice(config.variants.yearly, config),
      ]);
      prices = { monthly, yearly };
    } catch {
      prices = null;
    }
  }

  return (
    <div className="space-y-6">
      {testModeNotice}

      {trialNotice}

      {subscription ? (
        <Card title="Subscription">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-semibold">
              {PLAN_NAMES[
                planForVariant(config, subscription.provider_variant_id) ??
                  "monthly"
              ]}
            </p>
            <Badge tone={STATUS_LABELS[subscription.status].tone}>
              {STATUS_LABELS[subscription.status].label}
            </Badge>
          </div>
          <p className="mt-2 leading-7 text-muted">
            {describe(subscription, timezone)}
          </p>
          {subscription.raw_provider_fields?.cardLastFour ? (
            <p className="mt-1 text-sm text-muted">
              Paying with{" "}
              <span className="capitalize">
                {subscription.raw_provider_fields.cardBrand ?? "card"}
              </span>{" "}
              ending {subscription.raw_provider_fields.cardLastFour}.
            </p>
          ) : null}
          {getEntitlement(subscription).stale ? (
            <p className="mt-4 rounded-lg border border-attention-border bg-attention-soft px-4 py-3 text-sm leading-6 text-attention">
              This status has not been confirmed with the payment provider in
              the last 24 hours. Use Refresh status to check it now.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-start gap-3">
            <ManageBillingButton />
            {["active", "on_trial", "past_due"].includes(subscription.status) ? (
              <AutoRenewControl
                autoRenewOn
                accessUntil={
                  subscription.renews_at
                    ? formatDate(subscription.renews_at, timezone)
                    : null
                }
              />
            ) : null}
            {subscription.status === "cancelled" &&
            subscription.ends_at &&
            isInFuture(subscription.ends_at) ? (
              <AutoRenewControl
                autoRenewOn={false}
                accessUntil={formatDate(subscription.ends_at, timezone)}
              />
            ) : null}
            <RefreshStatusButton />
          </div>
          <p className="mt-4 border-t border-border pt-4 text-sm leading-6 text-muted">
            Manage billing opens the secure payment portal, where you can
            update your card, download invoices, change plan, or cancel. Last
            checked {formatDate(subscription.synced_at, timezone)}.
          </p>
        </Card>
      ) : null}

      {canSubscribe ? (
        <Card
          title={subscription ? "Subscribe again" : "Choose a plan"}
          description="Payment is handled securely by Lemon Squeezy. RepairLog never sees your card details."
        >
          {returnedFromCheckout ? (
            <div className="mb-5">
              <CheckoutPending />
            </div>
          ) : null}

          {prices ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <PlanCard plan="monthly" price={prices.monthly} highlighted={false} />
              <PlanCard plan="yearly" price={prices.yearly} highlighted />
            </div>
          ) : (
            <FormMessage tone="error">
              Plans could not be loaded from the payment provider. Please
              reload the page in a moment.
            </FormMessage>
          )}

          <ul className="mt-6 grid gap-2 border-t border-border pt-5 text-sm sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckIcon className="size-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
