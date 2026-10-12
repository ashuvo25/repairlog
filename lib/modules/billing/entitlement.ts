export type SubscriptionStatus =
  | "on_trial"
  | "active"
  | "cancelled"
  | "past_due"
  | "unpaid"
  | "expired"
  | "paused";

export type SubscriptionProjection = {
  status: SubscriptionStatus;
  provider_variant_id: string;
  provider_subscription_id: string;
  trial_ends_at: string | null;
  renews_at: string | null;
  ends_at: string | null;
  synced_at: string;
};

export type Entitlement = {
  // Whether the café may use paid features right now.
  entitled: boolean;
  // The owner should fix a payment problem even though access continues.
  needsPaymentAction: boolean;
  // The local copy is too old to trust for new paid writes.
  stale: boolean;
};

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function isFuture(value: string | null, now: number) {
  return value !== null && new Date(value).getTime() > now;
}

// Rules from the system design, section 11. Access is never extended past a
// boundary the provider reported.
export function getEntitlement(
  subscription: SubscriptionProjection | null,
  now = Date.now(),
): Entitlement {
  if (!subscription) {
    return { entitled: false, needsPaymentAction: false, stale: false };
  }

  const stale =
    now - new Date(subscription.synced_at).getTime() > STALE_AFTER_MS;
  let entitled = false;

  switch (subscription.status) {
    case "active":
    case "past_due":
      entitled = true;
      break;
    case "on_trial":
      entitled =
        subscription.trial_ends_at === null ||
        isFuture(subscription.trial_ends_at, now);
      break;
    case "cancelled":
      entitled = isFuture(subscription.ends_at, now);
      break;
    case "unpaid":
    case "expired":
    case "paused":
      entitled = false;
      break;
  }

  return {
    entitled: entitled && !stale,
    needsPaymentAction:
      subscription.status === "past_due" || subscription.status === "unpaid",
    stale,
  };
}

const STATUS_RANK: Record<SubscriptionStatus, number> = {
  active: 0,
  on_trial: 1,
  past_due: 2,
  cancelled: 3,
  paused: 4,
  unpaid: 5,
  expired: 6,
};

// A café can end up with more than one record (for example after an expired
// subscription is replaced); the most useful one is shown.
export function pickCurrentSubscription<T extends SubscriptionProjection>(
  subscriptions: readonly T[],
): T | null {
  return (
    [...subscriptions].sort(
      (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
    )[0] ?? null
  );
}
