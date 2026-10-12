// Netlify scheduled function: asks the app to retry failed billing events and
// reconcile subscriptions. The work itself lives in lib/jobs/billing/run.ts.
export default async function billingWorker() {
  const appUrl = process.env.APP_URL;
  const secret = process.env.CRON_SECRET;

  if (!appUrl || !secret) {
    console.error("billing-worker: APP_URL or CRON_SECRET is not set.");
    return;
  }

  const response = await fetch(new URL("/api/jobs/billing", appUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

  console.log("billing-worker:", response.status, await response.text());
}

export const config = {
  schedule: "*/5 * * * *",
};
