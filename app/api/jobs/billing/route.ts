import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runBillingJobs } from "@/lib/jobs/billing/run";
import { isBillingConfigured } from "@/lib/providers/lemonsqueezy/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";

  if (!secret || !header.startsWith("Bearer ")) {
    return false;
  }

  const expected = Buffer.from(secret);
  const received = Buffer.from(header.slice("Bearer ".length));

  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Called every five minutes by netlify/functions/billing-worker.mts.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { message: "Billing is not configured." },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json(await runBillingJobs());
  } catch (error) {
    console.error("Billing job run failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ message: "Run failed." }, { status: 500 });
  }
}
