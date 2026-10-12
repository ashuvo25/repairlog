import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { getSiteDetails } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service",
};

export default function TermsPage() {
  const site = getSiteDetails();
  const contact = site.supportEmail ?? "the contact on our Support page";

  return (
    <LegalPage title="Terms of service" lastUpdated={site.lastUpdated}>
      <section>
        <h2>The service</h2>
        <p>
          RepairLog is provided by {site.operatorName}. It records equipment
          faults, repairs and costs for a café. It is a record-keeping tool,
          not an accounting system, a safety system or a substitute for
          professional inspection of equipment.
        </p>
      </section>

      <section>
        <h2>Free trial and early access</h2>
        <p>
          Every café starts with a 15-day free trial. When it ends without a
          paid plan, public QR reporting pauses until a plan is chosen; your
          records stay available. RepairLog is in early access. Features may
          change, and we may limit the number of cafés, staff or photos to
          keep the service reliable.
        </p>
      </section>

      <section>
        <h2>Your account and team</h2>
        <ul>
          <li>Owners are responsible for who they invite and remove.</li>
          <li>Keep your Google account secure; it is how you sign in.</li>
          <li>Use RepairLog only for your café&apos;s lawful business operations.</li>
          <li>
            Do not upload content you have no right to share, or personal data
            beyond what a fault report needs.
          </li>
        </ul>
      </section>

      <section>
        <h2>Your data</h2>
        <p>
          You own the records your café enters and can export them as CSV at
          any time. How we handle personal data is described in the privacy
          policy.
        </p>
      </section>

      <section>
        <h2>Payment</h2>
        <p>
          Paid plans are sold through Lemon Squeezy, which acts as merchant of
          record and handles payment, tax and invoices. Subscriptions renew
          automatically until cancelled. When you cancel, access continues
          until the end of the period already paid.
        </p>
      </section>

      <section>
        <h2>Availability and liability</h2>
        <p>
          We work to keep RepairLog available and backed up, but we do not
          guarantee uninterrupted service. To the extent the law allows, our
          total liability is limited to the amount you paid us in the twelve
          months before a claim, and we are not liable for lost revenue or
          indirect losses.
        </p>
      </section>

      <section>
        <h2>Ending the service</h2>
        <p>
          You can stop using RepairLog and cancel at any time. We may suspend
          accounts that abuse the service or fail to pay, after notice where
          practical.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these terms go to {contact}.</p>
      </section>
    </LegalPage>
  );
}
