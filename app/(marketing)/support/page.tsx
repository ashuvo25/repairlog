import type { Metadata } from "next";

import { cardClasses } from "@/components/ui/card";
import { getSiteDetails } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support",
};

const LIMITS = [
  "RepairLog is in an invited pilot; access is granted café by café.",
  "One location per café and up to 10 staff members.",
  "Up to two photos per report, stored at most 1 MB each.",
  "Reports from QR codes are rate-limited to stop spam.",
  "The app works in any modern browser; there is no offline mode yet.",
  "We aim for high availability but do not offer a guaranteed uptime level.",
] as const;

const FAQ = [
  [
    "A staff member cannot sign in",
    "They must use exactly the Google account the invitation was sent to. The owner can send a new invitation from Settings → Team.",
  ],
  [
    "A QR label stopped working",
    "The machine may be archived, or its code was replaced. Open the machine in Equipment and print the current label.",
  ],
  [
    "How do I cancel or change my plan?",
    "Owners go to Settings → Billing → Manage billing. Access continues until the end of the paid period.",
  ],
  [
    "Can I get my data out?",
    "Yes. Owners can download CSV files from Settings → Export at any time.",
  ],
] as const;

export default function SupportPage() {
  const site = getSiteDetails();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Support</h1>
      <p className="mt-3 text-lg leading-8 text-muted">
        We are a small team and read every message.
      </p>

      <section className={`${cardClasses} mt-8 p-6`}>
        <h2 className="text-lg font-semibold">Contact us</h2>
        {site.supportEmail ? (
          <p className="mt-2 leading-7">
            Email{" "}
            <a
              href={`mailto:${site.supportEmail}`}
              className="font-semibold text-primary hover:underline"
            >
              {site.supportEmail}
            </a>
            . We usually reply within one business day.
          </p>
        ) : (
          <p className="mt-2 leading-7 text-muted">
            Pilot cafés can reach the RepairLog team through their onboarding
            contact.
          </p>
        )}
        <p className="mt-3 text-sm leading-6 text-muted">
          For a broken machine, open a ticket in RepairLog and call your
          technician. RepairLog support cannot repair equipment.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Common questions</h2>
        <dl className="mt-4 space-y-5">
          {FAQ.map(([question, answer]) => (
            <div key={question}>
              <dt className="font-semibold">{question}</dt>
              <dd className="mt-1 leading-7 text-muted">{answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Service limits</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-muted">
          {LIMITS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
