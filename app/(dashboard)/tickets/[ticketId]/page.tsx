import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink, PageHeader } from "@/components/layout/page-header";
import { Tip } from "@/components/onboarding/tip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/lib/modules/equipment/validation";
import {
  formatMoney,
  PRIORITY_LABELS,
  STATUS_LABELS,
  todayInTimezone,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/modules/tickets/constants";
import { requireMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import { TicketPhotoUpload } from "../photo-upload";
import { RepairUpdateForm, StatusActions } from "../ticket-management";

export const metadata: Metadata = {
  title: "Ticket",
};

const PHOTO_BUCKET = "repair-photos";
const PHOTO_LINK_SECONDS = 600;

type TicketDetail = {
  id: string;
  equipment_id: string;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  version: number;
  resolved_at: string | null;
  reopened_reason: string | null;
  created_at: string;
};

type RepairUpdate = {
  update_id: string;
  technician_name: string | null;
  work_note: string;
  work_date: string;
  recorded_by_email: string;
};

type CostRow = { id: string; amount_minor: number; recorded_date: string };

export default async function TicketDetailPage({
  params,
}: PageProps<"/tickets/[ticketId]">) {
  const { ticketId } = await params;

  if (!isUuid(ticketId)) {
    notFound();
  }

  const membership = await requireMembership();
  const isOwner = membership.role === "owner";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id, equipment_id, priority, status, description, version, resolved_at, reopened_reason, created_at",
    )
    .eq("organization_id", membership.organizationId)
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the ticket.");
  }

  if (!data) {
    notFound();
  }

  const ticket = data as TicketDetail;
  const [organizationResult, equipmentResult, updatesResult, photosResult, costsResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("timezone, currency")
        .eq("id", membership.organizationId)
        .single(),
      supabase
        .from("equipment")
        .select("name")
        .eq("organization_id", membership.organizationId)
        .eq("id", ticket.equipment_id)
        .maybeSingle(),
      supabase.rpc("list_repair_updates", {
        p_organization_id: membership.organizationId,
        p_ticket_id: ticket.id,
      }),
      supabase
        .from("attachments")
        .select("photo_slot, storage_path")
        .eq("organization_id", membership.organizationId)
        .eq("ticket_id", ticket.id)
        .eq("upload_state", "ready")
        .order("photo_slot", { ascending: true }),
      // Row-level security returns costs to owners only.
      isOwner
        ? supabase
            .from("repair_costs")
            .select("id, amount_minor, recorded_date")
            .eq("organization_id", membership.organizationId)
            .eq("ticket_id", ticket.id)
            .order("recorded_date", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

  const timezone: string = organizationResult.data?.timezone ?? "UTC";
  const currency: string = organizationResult.data?.currency ?? "USD";
  const updates = (updatesResult.data ?? []) as RepairUpdate[];
  const costs = (costsResult.data ?? []) as CostRow[];
  const totalCost = costs.reduce((sum, cost) => sum + cost.amount_minor, 0);
  const photoPaths = ((photosResult.data ?? []) as { storage_path: string }[]).map(
    (photo) => photo.storage_path,
  );
  const signed = photoPaths.length
    ? await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(photoPaths, PHOTO_LINK_SECONDS)
    : { data: [] };
  const photoUrls = (signed.data ?? [])
    .map((item) => item.signedUrl)
    .filter((url): url is string => Boolean(url));
  const equipmentName = equipmentResult.data?.name ?? "Equipment";

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <BackLink href="/tickets">Back to tickets</BackLink>

      <div className="mt-4">
        <PageHeader
          eyebrow={`Reported ${formatDate(ticket.created_at, timezone)}`}
          title={equipmentName}
          actions={
            <>
              <Badge tone={PRIORITY_LABELS[ticket.priority].tone}>
                {PRIORITY_LABELS[ticket.priority].label} priority
              </Badge>
              <Badge tone={STATUS_LABELS[ticket.status].tone}>
                {STATUS_LABELS[ticket.status].label}
              </Badge>
            </>
          }
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card title="Problem">
            <p className="leading-7 break-words whitespace-pre-wrap">
              {ticket.description}
            </p>
            {ticket.reopened_reason && ticket.status !== "resolved" ? (
              <p className="mt-4 rounded-lg border border-attention-border bg-attention-soft px-4 py-3 text-sm leading-6 text-attention">
                <span className="font-semibold">Reopened:</span>{" "}
                {ticket.reopened_reason}
              </p>
            ) : null}
            {photoUrls.length ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {photoUrls.map((url, index) => (
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
                      alt={`Photo ${index + 1} of the problem`}
                      loading="lazy"
                      className="size-28 object-cover sm:size-40"
                    />
                  </a>
                ))}
              </div>
            ) : null}
            {ticket.status !== "resolved" && photoPaths.length < 2 ? (
              <div className="mt-5">
                <TicketPhotoUpload
                  ticketId={ticket.id}
                  remaining={2 - photoPaths.length}
                />
              </div>
            ) : null}
            <p className="mt-5 border-t border-border pt-4 text-sm">
              <Link
                href={`/equipment/${ticket.equipment_id}`}
                className="font-semibold text-primary hover:underline"
              >
                View {equipmentName}
              </Link>
            </p>
          </Card>

          <Card
            title="Repair history"
            description="Work recorded on this ticket, newest first."
          >
            {updates.length ? (
              <ol className="space-y-5">
                {updates.map((update) => (
                  <li
                    key={update.update_id}
                    className="border-l-2 border-primary-border pl-4"
                  >
                    <p className="text-sm font-semibold">
                      {formatDate(`${update.work_date}T12:00:00Z`, "UTC")}
                      {update.technician_name ? (
                        <span className="font-normal text-muted">
                          {" "}
                          · {update.technician_name}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 leading-7 break-words whitespace-pre-wrap">
                      {update.work_note}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Recorded by {update.recorded_by_email}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg bg-subtle px-4 py-6 text-center text-sm leading-6 text-muted">
                No repair work recorded yet.
              </p>
            )}

            {isOwner && ticket.status !== "resolved" ? (
              <div className="mt-6 border-t border-border pt-5">
                <h3 className="font-semibold">Record repair work</h3>
                <div className="mt-4">
                  <RepairUpdateForm
                    // A fresh form (and request ID) after every saved entry.
                    key={updates.length}
                    ticketId={ticket.id}
                    today={todayInTimezone(timezone)}
                    currency={currency}
                  />
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          {isOwner && ticket.status === "awaiting_verification" ? (
            <Tip tipKey="repair_closure" />
          ) : null}

          <Card title="Status">
            {ticket.status === "resolved" && ticket.resolved_at ? (
              <p className="mb-4 text-sm leading-6 text-muted">
                Verified and resolved on {formatDate(ticket.resolved_at, timezone)}.
              </p>
            ) : null}
            <StatusActions
              ticketId={ticket.id}
              version={ticket.version}
              status={ticket.status}
              isOwner={isOwner}
            />
          </Card>

          {isOwner ? (
            <Card title="Costs" description="Visible to owners only.">
              {costs.length ? (
                <>
                  <ul className="divide-y divide-border text-sm">
                    {costs.map((cost) => (
                      <li
                        key={cost.id}
                        className="flex items-center justify-between gap-4 py-2 first:pt-0"
                      >
                        <span className="text-muted">
                          {formatDate(`${cost.recorded_date}T12:00:00Z`, "UTC")}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatMoney(cost.amount_minor, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex items-center justify-between border-t border-border pt-3 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {formatMoney(totalCost, currency)}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm leading-6 text-muted">
                  No costs recorded. Add a cost when you record repair work.
                </p>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}
