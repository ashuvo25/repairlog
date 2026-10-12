import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { getSiteDetails } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
};

export default function PrivacyPage() {
  const site = getSiteDetails();
  const contact = site.supportEmail ?? "the contact on our Support page";

  return (
    <LegalPage title="Privacy policy" lastUpdated={site.lastUpdated}>
      <section>
        <h2>Who we are</h2>
        <p>
          RepairLog is operated by {site.operatorName}
          {site.operatorCountry ? `, based in ${site.operatorCountry}` : ""}.
          It helps cafés record equipment faults and repairs. Questions about
          this policy go to {contact}.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> the name and email address from
            the Google account you sign in with.
          </li>
          <li>
            <strong>Café records:</strong> café details, equipment, tickets,
            repair notes, costs and menu items that your team enters.
          </li>
          <li>
            <strong>QR reports:</strong> the description and any photos a
            person sends from a QR code. We do not ask for their name or
            contact details. Photos are re-saved without location or device
            information.
          </li>
          <li>
            <strong>Abuse protection:</strong> to limit spam we keep a one-way,
            daily-changing hash of the network address that sent a QR report.
            We do not store the address itself.
          </li>
          <li>
            <strong>Billing:</strong> subscription status and dates from our
            payment provider. Card details are handled by Lemon Squeezy and
            never reach us.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          Only to run the service: showing your team its records, sending
          invitations, managing your subscription, preventing abuse and
          keeping backups. We do not sell personal data or use it for
          advertising.
        </p>
      </section>

      <section>
        <h2>Who can see it</h2>
        <p>
          Your café&apos;s records are visible only to its signed-in team.
          Repair costs and billing are visible to owners only. A QR page shows
          only the café name and the machine name.
        </p>
        <p>We rely on these providers to operate RepairLog:</p>
        <ul>
          <li>Supabase: database, sign-in and photo storage</li>
          <li>Netlify: website hosting</li>
          <li>Lemon Squeezy: payments and invoices</li>
          <li>Google: sign-in</li>
          <li>Cloudflare: bot protection on QR report forms</li>
        </ul>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Records are kept while your café uses RepairLog so repair history
          stays complete. After you close your account we delete café records
          and photos within 90 days, except billing records we must keep by
          law.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          Owners can export their records as CSV files at any time. To access,
          correct or delete personal data, contact {contact}.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes in a meaningful way we will update the date
          above and tell café owners by email.
        </p>
      </section>
    </LegalPage>
  );
}
