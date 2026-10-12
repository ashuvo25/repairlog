import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { cardClasses } from "@/components/ui/card";
import { PlusIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/modules/tickets/constants";
import { requireMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export const metadata: Metadata = {
  title: "Tickets",
};

const PAGE_SIZE = 100;

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "awaiting", label: "Awaiting verification" },
  { key: "resolved", label: "Resolved" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const FILTER_STATUSES: Record<FilterKey, TicketStatus[]> = {
  active: ["open", "in_progress", "awaiting_verification"],
  awaiting: ["awaiting_verification"],
  resolved: ["resolved"],
};

type TicketRow = {
  id: string;
  equipment_id: string;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  created_at: string;
};

export default async function TicketsPage({
  searchParams,
}: PageProps<"/tickets">) {
  const membership = await requireMembership();
  const requested = (await searchParams).show;
  const filter: FilterKey =
    FILTERS.find((item) => item.key === requested)?.key ?? "active";
  const supabase = await createClient();

  const [organizationResult, ticketsResult, equipmentResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("timezone")
      .eq("id", membership.organizationId)
      .single(),
    supabase
      .from("tickets")
      .select("id, equipment_id, priority, status, description, created_at")
      .eq("organization_id", membership.organizationId)
      .in("status", FILTER_STATUSES[filter])
      .order("updated_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from("equipment")
      .select("id, name")
      .eq("organization_id", membership.organizationId),
  ]);

  if (ticketsResult.error) {
    throw new Error("Unable to load tickets.");
  }

  const timezone: string = organizationResult.data?.timezone ?? "UTC";
  const tickets = (ticketsResult.data ?? []) as TicketRow[];
  const equipmentNames = new Map(
    ((equipmentResult.data ?? []) as { id: string; name: string }[]).map(
      (item) => [item.id, item.name],
    ),
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Tickets"
        description="Every fault your team is tracking, from first report to verified repair."
        actions={
          <Link href="/tickets/new" className={buttonClasses()}>
            <PlusIcon />
            Report a fault
          </Link>
        }
      />

      <nav aria-label="Ticket filters" className="mt-6 flex flex-wrap gap-1">
        {FILTERS.map((item) => {
          const active = item.key === filter;

          return (
            <Link
              key={item.key}
              href={item.key === "active" ? "/tickets" : `/tickets?show=${item.key}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted hover:bg-subtle hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tickets.length ? (
        <ul className={`${cardClasses} mt-4 divide-y divide-border`}>
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/tickets/${ticket.id}`}
                className="flex flex-col gap-3 px-5 py-4 hover:bg-subtle sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {equipmentNames.get(ticket.equipment_id) ?? "Equipment"}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">
                    {ticket.description}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Reported {formatDate(ticket.created_at, timezone)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge tone={PRIORITY_LABELS[ticket.priority].tone}>
                    {PRIORITY_LABELS[ticket.priority].label}
                  </Badge>
                  <Badge tone={STATUS_LABELS[ticket.status].tone}>
                    {STATUS_LABELS[ticket.status].label}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center leading-7 text-muted">
          {filter === "active"
            ? "No reported faults. New reports will appear here."
            : "Nothing here yet."}
        </p>
      )}
    </main>
  );
}
