import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { cardClasses } from "@/components/ui/card";
import { CheckIcon } from "@/components/ui/icons";
import { getVariantPrice } from "@/lib/providers/lemonsqueezy/client";
import {
  getLemonSqueezyConfig,
  isBillingConfigured,
} from "@/lib/providers/lemonsqueezy/config";

export const metadata: Metadata = {
  title: "Pricing",
  description: "One simple plan for an independent café.",
};

// Prices come from the payment provider and refresh every 15 minutes.
export const revalidate = 900;

const INCLUDED = [
  "One café location",
  "Up to 10 staff members",
  "QR fault reporting with photos, no app needed",
  "Tickets, repair history and owner-only costs",
  "Menu impact and a daily summary",
  "CSV export of all your records",
] as const;

function formatPrice(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

async function loadPrices() {
  if (!isBillingConfigured()) {
    return null;
  }

  try {
    const config = getLemonSqueezyConfig();
    const [monthly, yearly] = await Promise.all([
      getVariantPrice(config.variants.monthly, config),
      getVariantPrice(config.variants.yearly, config),
    ]);
    return { monthly, yearly };
  } catch {
    return null;
  }
}

export default async function PricingPage() {
  const prices = await loadPrices();
  const yearlySaving =
    prices && prices.monthly.priceMinor > 0
      ? Math.round(
          (1 - prices.yearly.priceMinor / (prices.monthly.priceMinor * 12)) * 100,
        )
      : 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Simple pricing for one café
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted">
          Everything RepairLog does, for one location. Cancel any time from
          your billing settings.
        </p>
      </div>

      {prices ? (
        <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
          {(
            [
              ["Monthly", prices.monthly, "month", false],
              ["Yearly", prices.yearly, "year", true],
            ] as const
          ).map(([name, price, interval, highlighted]) => (
            <div
              key={name}
              className={`${cardClasses} flex flex-col p-6 ${highlighted ? "border-primary" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{name}</h2>
                {highlighted && yearlySaving > 0 ? (
                  <Badge tone="positive">Save {yearlySaving}%</Badge>
                ) : null}
              </div>
              <p className="mt-4">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {formatPrice(price.priceMinor)}
                </span>
                <span className="text-muted"> / {interval}</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                {price.hasFreeTrial && price.trialDays
                  ? `${price.trialDays}-day free trial included.`
                  : "After your 15-day free trial. Billed in US dollars."}
              </p>
              <Link
                href="/sign-in?next=/settings/billing"
                className={`mt-6 ${buttonClasses({ variant: highlighted ? "primary" : "secondary", fullWidth: true })}`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="mx-auto mt-12 max-w-xl rounded-xl border border-border bg-surface px-6 py-5 text-center leading-7 text-muted">
          Start with a 15-day free trial. Pricing appears here shortly.
        </p>
      )}

      <div className={`${cardClasses} mx-auto mt-8 max-w-3xl p-6`}>
        <h2 className="font-semibold">Every plan includes</h2>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm leading-6">
              <CheckIcon className="mt-1 size-4 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-muted">
          Every café starts with a 15-day free trial, no card needed. Payments are
          processed by Lemon Squeezy, our merchant of record; RepairLog never
          sees your card details.
        </p>
      </div>
    </div>
  );
}
