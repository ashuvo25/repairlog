import { createHmac, timingSafeEqual } from "node:crypto";

import { getLemonSqueezyConfig, type LemonSqueezyConfig } from "./config";

const API_BASE = "https://api.lemonsqueezy.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;

export class LemonSqueezyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LemonSqueezyError";
  }

  // Rate limits, timeouts and provider outages are worth retrying.
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

async function request<T>(
  config: LemonSqueezyConfig,
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; revalidate?: number },
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(init?.revalidate
        ? { next: { revalidate: init.revalidate } }
        : { cache: "no-store" as const }),
    });
  } catch {
    throw new LemonSqueezyError("Lemon Squeezy could not be reached.", 0);
  }

  if (!response.ok) {
    throw new LemonSqueezyError(
      `Lemon Squeezy request failed: ${init?.method ?? "GET"} ${path}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export type ProviderSubscription = {
  id: string;
  storeId: string;
  customerId: string;
  orderId: string | null;
  productId: string;
  variantId: string;
  status: string;
  testMode: boolean;
  cancelled: boolean;
  paused: boolean;
  createdAt: string;
  updatedAt: string;
  trialEndsAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  customerPortalUrl: string | null;
  display: {
    productName: string | null;
    variantName: string | null;
    cardBrand: string | null;
    cardLastFour: string | null;
  };
};

type JsonApiResource = {
  id: string;
  attributes: Record<string, unknown>;
};

function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function idText(value: unknown) {
  return typeof value === "number" || typeof value === "string"
    ? String(value)
    : "";
}

export async function getSubscription(
  subscriptionId: string,
  config = getLemonSqueezyConfig(),
): Promise<ProviderSubscription> {
  const { data } = await request<{ data: JsonApiResource }>(
    config,
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
  const a = data.attributes;
  const urls = (a.urls ?? {}) as Record<string, unknown>;

  return {
    id: data.id,
    storeId: idText(a.store_id),
    customerId: idText(a.customer_id),
    orderId: idText(a.order_id) || null,
    productId: idText(a.product_id),
    variantId: idText(a.variant_id),
    status: text(a.status) ?? "",
    testMode: a.test_mode === true,
    cancelled: a.cancelled === true,
    paused: a.pause !== null && a.pause !== undefined,
    createdAt: text(a.created_at) ?? "",
    updatedAt: text(a.updated_at) ?? "",
    trialEndsAt: text(a.trial_ends_at),
    renewsAt: text(a.renews_at),
    endsAt: text(a.ends_at),
    customerPortalUrl: text(urls.customer_portal),
    display: {
      productName: text(a.product_name),
      variantName: text(a.variant_name),
      cardBrand: text(a.card_brand),
      cardLastFour: text(a.card_last_four),
    },
  };
}

export type ProviderInvoice = {
  id: string;
  storeId: string;
  subscriptionId: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  createdAt: string;
  updatedAt: string;
  refundedAt: string | null;
};

function minor(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

export async function getSubscriptionInvoice(
  invoiceId: string,
  config = getLemonSqueezyConfig(),
): Promise<ProviderInvoice> {
  const { data } = await request<{ data: JsonApiResource }>(
    config,
    `/subscription-invoices/${encodeURIComponent(invoiceId)}`,
  );
  const a = data.attributes;

  return {
    id: data.id,
    storeId: idText(a.store_id),
    subscriptionId: idText(a.subscription_id),
    status: text(a.status) ?? "unknown",
    currency: (text(a.currency) ?? "USD").toUpperCase(),
    subtotalMinor: minor(a.subtotal),
    discountMinor: minor(a.discount_total),
    taxMinor: minor(a.tax),
    totalMinor: minor(a.total),
    createdAt: text(a.created_at) ?? "",
    updatedAt: text(a.updated_at) ?? "",
    refundedAt: text(a.refunded_at),
  };
}

export type ProviderVariantPrice = {
  priceMinor: number;
  interval: string | null;
  hasFreeTrial: boolean;
  trialDays: number | null;
};

// Prices come from the provider so the page never shows a stale local copy.
export async function getVariantPrice(
  variantId: string,
  config = getLemonSqueezyConfig(),
): Promise<ProviderVariantPrice> {
  const { data } = await request<{ data: JsonApiResource }>(
    config,
    `/variants/${encodeURIComponent(variantId)}`,
    { revalidate: 900 },
  );
  const a = data.attributes;
  const hasFreeTrial = a.has_free_trial === true;

  return {
    priceMinor: minor(a.price),
    interval: text(a.interval),
    hasFreeTrial,
    trialDays:
      hasFreeTrial &&
      a.trial_interval === "day" &&
      typeof a.trial_interval_count === "number"
        ? a.trial_interval_count
        : null,
  };
}

export async function createCheckout(
  input: {
    variantId: string;
    email: string | null;
    binding: string;
    redirectUrl: string;
    expiresAt: string;
  },
  config = getLemonSqueezyConfig(),
): Promise<{ id: string; url: string }> {
  const { data } = await request<{ data: JsonApiResource }>(config, "/checkouts", {
    method: "POST",
    body: {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            ...(input.email ? { email: input.email } : {}),
            custom: { binding: input.binding },
          },
          product_options: {
            redirect_url: input.redirectUrl,
            enabled_variants: [Number(input.variantId)],
          },
          expires_at: input.expiresAt,
          test_mode: config.testMode,
        },
        relationships: {
          store: { data: { type: "stores", id: config.storeId } },
          variant: { data: { type: "variants", id: input.variantId } },
        },
      },
    },
  });
  const url = text(data.attributes.url);

  if (!url) {
    throw new LemonSqueezyError("Lemon Squeezy returned no checkout URL.", 502);
  }

  return { id: data.id, url };
}

export function verifyWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  secret: string,
) {
  if (!signatureHeader || !/^[0-9a-f]{64}$/i.test(signatureHeader)) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signatureHeader, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
}
