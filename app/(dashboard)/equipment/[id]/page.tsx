import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { BackLink, PageHeader } from "@/components/layout/page-header";
import { Tip } from "@/components/onboarding/tip";
import { Badge, ConditionBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, cardClasses } from "@/components/ui/card";
import { getAppUrl } from "@/lib/auth/app-url";
import { formatDate } from "@/lib/format";
import type { EquipmentCondition } from "@/lib/modules/equipment/conditions";
import { isUuid } from "@/lib/modules/equipment/validation";
import { requireMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import {
  ArchiveEquipmentForm,
  ConditionForm,
  EditEquipmentForm,
  RotateQrForm,
} from "../equipment-management";
import { QrActions } from "../qr-actions";

export const metadata: Metadata = {
  title: "Equipment details",
};

type EquipmentDetail = {
  id: string;
  location_id: string;
  name: string;
  category: string;
  condition: EquipmentCondition;
  version: number;
  archived_at: string | null;
  public_report_code: string;
  public_reporting_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export default async function EquipmentDetailPage({
  params,
}: PageProps<"/equipment/[id]">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const membership = await requireMembership();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipment")
    .select(
      "id, location_id, name, category, condition, version, archived_at, public_report_code, public_reporting_enabled, created_at, updated_at",
    )
    .eq("organization_id", membership.organizationId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load equipment details.");
  }

  if (!data) {
    notFound();
  }

  const equipment = data as EquipmentDetail;
  const [{ data: location }, { data: organization }] = await Promise.all([
    supabase
      .from("locations")
      .select("name")
      .eq("organization_id", membership.organizationId)
      .eq("id", equipment.location_id)
      .single(),
    supabase
      .from("organizations")
      .select("name, timezone")
      .eq("id", membership.organizationId)
      .single(),
  ]);

  const appUrl = getAppUrl();
  const reportUrl = new URL(
    `/report/${equipment.public_report_code}`,
    appUrl,
  ).toString();
  const qrDataUrl = equipment.public_reporting_enabled
    ? await QRCode.toDataURL(reportUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 640,
        color: { dark: "#17251d", light: "#ffffff" },
      })
    : null;
  const isArchived = Boolean(equipment.archived_at);
  const canManage = membership.role === "owner" && !isArchived;
  const timezone = organization?.timezone;

  const facts = [
    ["Location", location?.name ?? "—"],
    ["Category", equipment.category],
    ["Added", formatDate(equipment.created_at, timezone)],
    ["Last changed", formatDate(equipment.updated_at, timezone)],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <BackLink href="/equipment">Back to equipment</BackLink>

      <div className="mt-4">
        <PageHeader
          eyebrow={`${organization?.name ?? "Your café"} · ${location?.name ?? "Main location"}`}
          title={equipment.name}
          actions={
            <>
              {isArchived ? null : (
                <Link
                  href={`/tickets/new?equipment=${equipment.id}`}
                  className={buttonClasses({ variant: "secondary" })}
                >
                  Report a fault
                </Link>
              )}
              <ConditionBadge condition={equipment.condition} />
              {isArchived ? <Badge>Archived</Badge> : null}
            </>
          }
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card title="Equipment record">
            <dl className="grid gap-5 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm font-medium text-muted">{label}</dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {canManage ? (
            <>
              <Card title="Confirm condition">
                <ConditionForm
                  equipmentId={equipment.id}
                  version={equipment.version}
                  condition={equipment.condition}
                />
              </Card>

              <Card title="Edit details">
                <EditEquipmentForm
                  equipmentId={equipment.id}
                  version={equipment.version}
                  name={equipment.name}
                  category={equipment.category}
                />
              </Card>
            </>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className={`qr-print-card ${cardClasses} p-5 sm:p-6`}>
            <h2 className="text-lg font-semibold tracking-tight">
              Scan to report a problem
            </h2>
            {qrDataUrl ? (
              <>
                <div className="mx-auto mt-5 w-fit rounded-xl border border-border bg-white p-3">
                  <Image
                    src={qrDataUrl}
                    width={320}
                    height={320}
                    unoptimized
                    alt={`QR code for reporting a problem with ${equipment.name}`}
                    className="size-56 sm:size-64"
                  />
                </div>
                <p className="mt-4 text-center font-semibold">
                  {equipment.name}
                </p>
                <p className="mt-1 text-center text-sm text-muted">
                  {organization?.name ?? "RepairLog café"}
                </p>
                <p className="qr-screen-actions mt-4 break-all rounded-lg bg-subtle px-3 py-2 font-mono text-xs text-muted">
                  {reportUrl}
                </p>
                <QrActions
                  reportUrl={reportUrl}
                  qrDataUrl={qrDataUrl}
                  fileName={`repairlog-qr-${equipment.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "") || "equipment"}.png`}
                />
                {appUrl.hostname === "localhost" ? (
                  <p className="qr-screen-actions mt-4 rounded-lg border border-attention-border bg-attention-soft px-3 py-2 text-xs leading-5 text-attention">
                    This is a local test code. It only works on this computer,
                    so print labels from the live site.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-4 rounded-lg bg-subtle px-4 py-3 text-sm leading-6 text-muted">
                Public reporting is turned off for archived equipment.
              </p>
            )}
          </section>

          {canManage && qrDataUrl ? (
            <div className="qr-screen-actions">
              <Tip tipKey="qr_label" />
            </div>
          ) : null}

          {canManage ? (
            <>
              <Card title="QR security">
                <RotateQrForm
                  equipmentId={equipment.id}
                  version={equipment.version}
                />
              </Card>

              <Card title="Archive equipment">
                <ArchiveEquipmentForm
                  equipmentId={equipment.id}
                  version={equipment.version}
                  name={equipment.name}
                />
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
