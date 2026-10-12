export type BillingPlan = "monthly" | "yearly";

export type LemonSqueezyConfig = {
  apiKey: string;
  webhookSecret: string;
  storeId: string;
  testMode: boolean;
  environment: "test" | "live";
  variants: Record<BillingPlan, string>;
};

function required(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getLemonSqueezyConfig(): LemonSqueezyConfig {
  // Anything other than an explicit "false" keeps the safer test mode.
  const testMode = process.env.LEMONSQUEEZY_TEST_MODE?.trim() !== "false";

  return {
    apiKey: required("LEMONSQUEEZY_API_KEY"),
    webhookSecret: required("LEMONSQUEEZY_WEBHOOK_SECRET"),
    storeId: required("LEMONSQUEEZY_STORE_ID"),
    testMode,
    environment: testMode ? "test" : "live",
    variants: {
      monthly: required("LEMONSQUEEZY_VARIANT_ID_MONTHLY"),
      yearly: required("LEMONSQUEEZY_VARIANT_ID_YEARLY"),
    },
  };
}

export function isBillingConfigured() {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
      process.env.LEMONSQUEEZY_WEBHOOK_SECRET &&
      process.env.LEMONSQUEEZY_STORE_ID &&
      process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY &&
      process.env.LEMONSQUEEZY_VARIANT_ID_YEARLY &&
      process.env.SUPABASE_SECRET_KEY,
  );
}

export function planForVariant(
  config: LemonSqueezyConfig,
  variantId: string,
): BillingPlan | null {
  if (variantId === config.variants.monthly) {
    return "monthly";
  }

  if (variantId === config.variants.yearly) {
    return "yearly";
  }

  return null;
}
