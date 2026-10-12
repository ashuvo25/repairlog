import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { cardClasses } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { displayFont } from "@/lib/fonts";
import { loadAccessForReportCode } from "@/lib/modules/billing/access";
import { isUuid } from "@/lib/modules/equipment/validation";
import { isTurnstileEnabled } from "@/lib/modules/public-reports/server";
import { createAdminClient } from "@/lib/supabase/admin/client";
import { createClient } from "@/lib/supabase/server/client";

import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Report equipment problem",
  robots: { index: false, follow: false },
  // The URL is the machine's private reporting code.
  referrer: "no-referrer",
};

type PublicEquipmentContext = {
  cafe_name: string;
  equipment_name: string;
  equipment_category: string;
};

export default async function PublicEquipmentReportPage({
  params,
}: PageProps<"/report/[code]">) {
  const { code } = await params;

  if (!isUuid(code)) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_equipment_context", {
    p_public_report_code: code,
  });

  if (error) {
    throw new Error("Unable to open this equipment report page.");
  }

  const context = (Array.isArray(data) ? data[0] : data) as
    | PublicEquipmentContext
    | undefined;

  if (!context) {
    notFound();
  }

  const access = await loadAccessForReportCode(createAdminClient(), code);
  const paused = access?.state === "expired";

  return (
    <main className={`${displayFont.variable} theme-bistro mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6`}>
      <Logo />
      <div className="py-8">
        <p className="text-sm font-medium text-muted">{context.cafe_name}</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">
          Report a problem
        </h1>
        <section className={`${cardClasses} mt-5 flex items-center justify-between gap-4 p-4`}>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">Equipment</p>
            <p className="truncate text-lg font-semibold tracking-tight">
              {context.equipment_name}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-subtle px-2.5 py-1 text-xs font-semibold text-muted">
            {context.equipment_category}
          </span>
        </section>

        {paused ? (
          <div role="status" className="mt-6 rounded-lg border border-border bg-surface p-5">
            <p className="font-semibold">Online reporting is not available here right now.</p>
            <p className="mt-2 leading-7 text-muted">
              Please tell a member of staff or contact the shop owner about the
              problem with this machine.
            </p>
          </div>
        ) : (
        <ReportForm
          code={code}
          turnstileSiteKey={
            isTurnstileEnabled()
              ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null)
              : null
          }
        />
        )}
      </div>
    </main>
  );
}
