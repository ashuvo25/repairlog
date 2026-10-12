import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { cardClasses } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { pluralize } from "@/lib/format";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import { ReviewActions } from "./review-actions";

export const metadata: Metadata = {
  title: "Reports",
};

const PHOTO_BUCKET = "repair-photos";
const PHOTO_LINK_SECONDS = 600;
const PAGE_SIZE = 50;

type ReportRow = {
  id: string;
  equipment_id: string;
  description: string;
  status: "pending" | "accepted" | "dismissed";
  reviewed_at: string | null;
  created_at: string;
};

type PhotoRow = { report_id: string; photo_slot: number; storage_path: string };

function formatWhen(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export default async function ReportsPage() {
  const membership = await requireOwner();
  const supabase = await createClient();

  const [organizationResult, reportsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("timezone")
      .eq("id", membership.organizationId)
      .single(),
    supabase
      .from("public_reports")
      .select("id, equipment_id, description, status, reviewed_at, created_at")
      .eq("organization_id", membership.organizationId)
      // "pending" sorts last alphabetically, so descending puts it first.
      .order("status", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
  ]);

  // The table arrives with database/970_public_reports.sql.
  if (
    reportsResult.error?.code === "PGRST205" ||
    reportsResult.error?.code === "42P01"
  ) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        <FormMessage tone="error">
          Reports are not available yet. The database update
          970_public_reports.sql has not been applied.
        </FormMessage>
      </main>
    );
  }

  if (reportsResult.error) {
    throw new Error("Unable to load reports.");
  }

  const timezone: string = organizationResult.data?.timezone ?? "UTC";
  const reports = (reportsResult.data ?? []) as ReportRow[];
  const pending = reports.filter((report) => report.status === "pending");
  const reviewed = reports.filter((report) => report.status !== "pending");

  const equipmentIds = [...new Set(reports.map((report) => report.equipment_id))];
  const pendingIds = pending.map((report) => report.id);
  const [equipmentResult, photosResult] = await Promise.all([
    equipmentIds.length
      ? supabase
          .from("equipment")
          .select("id, name")
          .eq("organization_id", membership.organizationId)
          .in("id", equipmentIds)
      : Promise.resolve({ data: [] }),
    pendingIds.length
      ? supabase
          .from("public_report_photos")
          .select("report_id, photo_slot, storage_path")
          .eq("organization_id", membership.organizationId)
          .in("report_id", pendingIds)
          .order("photo_slot", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const equipmentNames = new Map(
    ((equipmentResult.data ?? []) as { id: string; name: string }[]).map(
      (item) => [item.id, item.name],
    ),
  );
  const photos = (photosResult.data ?? []) as PhotoRow[];
  const signed = photos.length
    ? await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(
          photos.map((photo) => photo.storage_path),
          PHOTO_LINK_SECONDS,
        )
    : { data: [] };
  const photoUrls = new Map<string, string[]>();
  photos.forEach((photo, index) => {
    const url = signed.data?.[index]?.signedUrl;
    if (url) {
      photoUrls.set(photo.report_id, [...(photoUrls.get(photo.report_id) ?? []), url]);
    }
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Reports"
        description="Problems sent from QR codes by people without an account. Nothing changes until you review them."
      />

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Needs review</h2>
          <span className="text-sm text-muted">
            {pluralize(pending.length, "report", "reports")}
          </span>
        </div>

        {pending.length ? (
          <ul className="mt-4 space-y-4">
            {pending.map((report) => (
              <li key={report.id} className={`${cardClasses} p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/equipment/${report.equipment_id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {equipmentNames.get(report.equipment_id) ?? "Equipment"}
                  </Link>
                  <span className="text-sm text-muted">
                    {formatWhen(report.created_at, timezone)}
                  </span>
                </div>
                <p className="mt-3 leading-7 break-words whitespace-pre-wrap">
                  {report.description}
                </p>
                {photoUrls.get(report.id)?.length ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {photoUrls.get(report.id)?.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-border"
                      >
                        {/* Signed, short-lived URL: not suitable for the image optimizer. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${index + 1} sent with this report`}
                          loading="lazy"
                          className="size-28 object-cover sm:size-36"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="mt-5 border-t border-border pt-4">
                  <ReviewActions reportId={report.id} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center leading-7 text-muted">
            No reports waiting. New reports from QR codes will appear here.
          </p>
        )}
      </section>

      {reviewed.length ? (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-semibold tracking-tight">
            Recently reviewed
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {reviewed.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {equipmentNames.get(report.equipment_id) ?? "Equipment"}
                  </p>
                  <p className="line-clamp-1 text-sm text-muted">
                    {report.description}
                  </p>
                </div>
                <Badge tone={report.status === "accepted" ? "positive" : "neutral"}>
                  {report.status === "accepted" ? "Accepted" : "Dismissed"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
