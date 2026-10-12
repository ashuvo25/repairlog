import type { Metadata } from "next";
import Link from "next/link";

import { StaffIntro } from "@/components/onboarding/staff-intro";
import { Badge, ConditionBadge } from "@/components/ui/badge";
import { cardClasses } from "@/components/ui/card";
import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardIcon,
  CupIcon,
  InboxIcon,
  PlusIcon,
  WrenchIcon,
} from "@/components/ui/icons";
import { formatLongDate } from "@/lib/format";
import type { EquipmentCondition } from "@/lib/modules/equipment/conditions";
import {
  loadMenuImpact,
  MENU_STATUS_LABELS,
} from "@/lib/modules/menu-impact/status";
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

export const metadata: Metadata = {
  title: "Today",
};

type EquipmentSummaryRow = {
  id: string;
  name: string;
  category: string;
  condition: EquipmentCondition;
};

type OpenTicketRow = {
  id: string;
  equipment_id: string;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  created_at: string;
};

const TICKET_LIST_LIMIT = 6;

const PRIORITY_BAR: Record<TicketPriority, string> = {
  urgent: "bg-danger",
  high: "bg-attention",
  medium: "bg-border-strong",
  low: "bg-border",
};

function greeting(timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(new Date()),
  );

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(value: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function Stat({
  icon: StatIcon,
  label,
  value,
  note,
  href,
  tone,
}: Readonly<{
  icon: (props: { className?: string }) => React.ReactNode;
  label: string;
  value: string | number;
  note: string;
  href: string;
  tone: "primary" | "danger" | "attention" | "success";
}>) {
  const toneClasses = {
    primary: "bg-primary-soft text-primary",
    danger: "bg-danger-soft text-danger",
    attention: "bg-attention-soft text-attention",
    success: "bg-success-soft text-success",
  }[tone];

  return (
    <Link
      href={href}
      className={`${cardClasses} group flex flex-col rounded-lg p-5 transition-colors hover:border-border-strong`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span
          className={`flex size-9 items-center justify-center rounded-full ${toneClasses}`}
        >
          <StatIcon className="size-[1.1rem]" />
        </span>
      </div>
      <span className="font-display mt-3 text-4xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-sm text-muted group-hover:text-foreground">
        {note}
      </span>
    </Link>
  );
}

export default async function TodayPage() {
  const membership = await requireMembership();
  const isOwner = membership.role === "owner";
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, timezone, currency")
    .eq("id", membership.organizationId)
    .single();
  const timezone: string = organization?.timezone ?? "UTC";
  const currency: string = organization?.currency ?? "USD";

  const [
    equipmentResult,
    ticketsResult,
    reportsResult,
    costsResult,
    menuItems,
    staffResult,
    faultsResult,
  ] = await Promise.all([
    supabase
      .from("equipment")
      .select("id, name, category, condition")
      .eq("organization_id", membership.organizationId)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("tickets")
      .select("id, equipment_id, priority, status, description, created_at", {
        count: "exact",
      })
      .eq("organization_id", membership.organizationId)
      .neq("status", "resolved")
      .order("updated_at", { ascending: false })
      .limit(TICKET_LIST_LIMIT),
    // Owner-only figures; row-level security also hides them from staff.
    isOwner
      ? supabase
          .from("public_reports")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", membership.organizationId)
          .eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    isOwner
      ? supabase
          .from("repair_costs")
          .select("amount_minor")
          .eq("organization_id", membership.organizationId)
          .eq("recorded_date", todayInTimezone(timezone))
      : Promise.resolve({ data: [] }),
    loadMenuImpact(supabase, membership.organizationId),
    isOwner
      ? supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", membership.organizationId)
          .eq("role", "staff")
          .eq("state", "active")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("tickets")
      .select("equipment_id")
      .eq("organization_id", membership.organizationId)
      .neq("status", "resolved"),
  ]);

  if (equipmentResult.error || ticketsResult.error) {
    throw new Error("Unable to load today's summary.");
  }

  const equipment = (equipmentResult.data ?? []) as EquipmentSummaryRow[];
  const openTickets = (ticketsResult.data ?? []) as OpenTicketRow[];
  const openTicketCount = ticketsResult.count ?? openTickets.length;
  const pendingReports = reportsResult.count ?? 0;
  const todaysCosts = (
    (costsResult.data ?? []) as { amount_minor: number }[]
  ).reduce((sum, cost) => sum + cost.amount_minor, 0);
  const equipmentNames = new Map(equipment.map((item) => [item.id, item.name]));
  const unavailable = equipment.filter(
    (item) => item.condition === "unavailable",
  );
  const offMenu = menuItems.filter((item) => item.status === "affected");
  const operationalCount = equipment.filter(
    (item) => item.condition === "operational",
  ).length;
  const faultsByMachine = new Map<string, number>();
  for (const row of (faultsResult.data ?? []) as { equipment_id: string }[]) {
    faultsByMachine.set(
      row.equipment_id,
      (faultsByMachine.get(row.equipment_id) ?? 0) + 1,
    );
  }
  const conditionOrder = {
    unavailable: 0,
    unknown: 1,
    operational: 2,
  } as const;
  const overview = [...equipment]
    .sort(
      (a, b) =>
        conditionOrder[a.condition] - conditionOrder[b.condition] ||
        a.name.localeCompare(b.name),
    )
    .map((machine) => ({
      ...machine,
      openFaults: faultsByMachine.get(machine.id) ?? 0,
      items: menuItems.filter((item) =>
        item.equipment.some((linked) => linked.id === machine.id),
      ),
    }));
  const unknownCount = equipment.filter(
    (item) => item.condition === "unknown",
  ).length;

  const setupSteps = [
    { label: "Create your café", done: true, href: "/settings/organization" },
    {
      label: "Add your first machine",
      done: equipment.length > 0,
      href: "/equipment/new",
    },
    {
      label: "Confirm every machine's condition",
      done: equipment.length > 0 && unknownCount === 0,
      href: "/equipment",
    },
    {
      label: "Link a menu item to its machines",
      done: menuItems.length > 0,
      href: "/menu-impact",
    },
    {
      label: "Invite a staff member",
      done: (staffResult.count ?? 0) > 0,
      href: "/settings/team",
    },
  ];
  const setupComplete = setupSteps.every((step) => step.done);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      {/* Greeting */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">
            {formatLongDate(new Date(), timezone)}
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-tight">
            {greeting(timezone)}, {organization?.name ?? "team"}.
          </h1>
          <p className="mt-2 text-muted">
            {openTicketCount === 0 && offMenu.length === 0
              ? "Everything's running. Nothing needs attention right now."
              : [
                  openTicketCount > 0
                    ? `${openTicketCount} open ${openTicketCount === 1 ? "ticket" : "tickets"}`
                    : null,
                  offMenu.length > 0
                    ? `${offMenu.length} menu ${offMenu.length === 1 ? "item" : "items"} off today`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/equipment"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-border-strong bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-subtle"
          >
            <WrenchIcon />
            Equipment
          </Link>
          <Link
            href="/tickets/new"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <PlusIcon />
            Report a fault
          </Link>
        </div>
      </div>

      {isOwner ? null : <StaffIntro />}

      {isOwner && pendingReports > 0 ? (
        <Link
          href="/reports"
          className="mt-6 flex items-center gap-4 rounded-lg border border-primary-border bg-primary-soft px-5 py-4 text-primary transition-colors hover:border-primary"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <InboxIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {pendingReports === 1
                ? "1 new report from a QR code"
                : `${pendingReports} new reports from QR codes`}
            </span>
            <span className="block text-sm opacity-80">
              Nothing changes until you accept or dismiss it.
            </span>
          </span>
          <ArrowRightIcon className="size-5" />
        </Link>
      ) : null}

      {/* Shift summary */}
      <section
        aria-label="Today's summary"
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <Stat
          icon={ClipboardIcon}
          label="Open tickets"
          value={openTicketCount}
          note="Not yet verified"
          href="/tickets"
          tone="primary"
        />
        <Stat
          icon={WrenchIcon}
          label="Machines down"
          value={unavailable.length}
          note={
            unavailable.length
              ? unavailable
                  .map((item) => item.name)
                  .slice(0, 2)
                  .join(", ")
              : "All running"
          }
          href="/equipment"
          tone={unavailable.length ? "danger" : "success"}
        />
        <Stat
          icon={CupIcon}
          label="Off the menu"
          value={offMenu.length}
          note={
            offMenu.length
              ? offMenu
                  .map((item) => item.name)
                  .slice(0, 2)
                  .join(", ")
              : "Full menu available"
          }
          href="/menu-impact"
          tone={offMenu.length ? "attention" : "success"}
        />
        {isOwner ? (
          <Stat
            icon={InboxIcon}
            label="Repair costs today"
            value={formatMoney(todaysCosts, currency)}
            note="Owner only"
            href="/tickets"
            tone="primary"
          />
        ) : (
          <Stat
            icon={WrenchIcon}
            label="Machines"
            value={equipment.length}
            note="Active equipment"
            href="/equipment"
            tone="primary"
          />
        )}
      </section>

      {/* Overview: every machine and the menu items that depend on it */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Machines &amp; menu
            </h2>
            <p className="mt-1 text-sm text-muted">
              {equipment.length === 1
                ? "1 machine"
                : `${equipment.length} machines`}{" "}
              · {operationalCount} working · {unavailable.length} down ·{" "}
              {unknownCount} to check
            </p>
          </div>
          <Link
            href="/equipment"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Manage equipment
          </Link>
        </div>

        {overview.length ? (
          <div className="mt-4">
            <ul
              aria-label="Machines and their menu items"
              tabIndex={0}
              className="grid max-h-[32rem] items-start gap-4 overflow-y-auto overscroll-contain rounded-lg pr-1 md:grid-cols-2 xl:grid-cols-3 [scrollbar-gutter:stable]"
            >
              {overview.map((machine) => (
                <li
                  key={machine.id}
                  className={`${cardClasses} overflow-hidden rounded-lg`}
                >
                  <Link
                    href={`/equipment/${machine.id}`}
                    className="flex items-center justify-between gap-3 border-b border-border bg-subtle px-4 py-3 hover:bg-border/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {machine.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {machine.category}
                        {machine.items.length
                          ? ` · ${machine.items.length} menu ${machine.items.length === 1 ? "item" : "items"}`
                          : ""}
                        {machine.openFaults > 0
                          ? ` · ${machine.openFaults} open ${machine.openFaults === 1 ? "fault" : "faults"}`
                          : ""}
                      </span>
                    </span>
                    <ConditionBadge condition={machine.condition} />
                  </Link>
                  {machine.items.length ? (
                    <ul className="max-h-[13.5rem] divide-y divide-border overflow-y-auto overscroll-contain">
                      {machine.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 pl-7 text-sm"
                        >
                          <span className="min-w-0 truncate">{item.name}</span>
                          <Badge tone={MENU_STATUS_LABELS[item.status].tone}>
                            {MENU_STATUS_LABELS[item.status].label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-muted">
                      No menu items linked.{" "}
                      {isOwner ? (
                        <Link
                          href="/menu-impact"
                          className="font-semibold text-primary hover:underline"
                        >
                          Link items
                        </Link>
                      ) : null}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {overview.length > 6 ? (
              <p className="mt-2 text-center text-xs text-muted">
                Showing all {overview.length} machines. Scroll inside the box to
                see more.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-border-strong bg-surface px-6 py-10 text-center text-sm text-muted">
            No equipment yet.{" "}
            {isOwner ? (
              <Link
                href="/equipment/new"
                className="font-semibold text-primary hover:underline"
              >
                Add your first machine
              </Link>
            ) : (
              "Ask an owner to add the first machine."
            )}
          </p>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        {/* Open tickets */}
        <section className={`${cardClasses} rounded-lg`}>
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <h2 className="font-display text-xl font-semibold">Open tickets</h2>
            <Link
              href="/tickets"
              className="text-sm font-semibold text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {openTickets.length ? (
            <ul className="divide-y divide-border">
              {openTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="flex items-stretch gap-4 px-5 py-4 transition-colors hover:bg-subtle"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-1 shrink-0 rounded-full ${PRIORITY_BAR[ticket.priority]}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-semibold">
                          {equipmentNames.get(ticket.equipment_id) ??
                            "Equipment"}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {timeAgo(ticket.created_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-sm text-muted">
                        {ticket.description}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone={STATUS_LABELS[ticket.status].tone}>
                          {STATUS_LABELS[ticket.status].label}
                        </Badge>
                        {ticket.priority === "urgent" ||
                        ticket.priority === "high" ? (
                          <Badge tone={PRIORITY_LABELS[ticket.priority].tone}>
                            {PRIORITY_LABELS[ticket.priority].label}
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckIcon className="size-6" />
              </span>
              <p className="font-display mt-4 text-lg font-semibold">
                No open faults
              </p>
              <p className="mt-1 text-sm text-muted">
                New reports will appear here.
              </p>
            </div>
          )}
        </section>

        <div className="space-y-6">
          {/* Chalkboard */}
          <section className="rounded-lg border-[6px] border-[#6b4a32] bg-[#1e2622] p-5 text-[#efeae0] shadow-md">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl italic">
                Off the menu today
              </h2>
              <Link
                href="/menu-impact"
                className="text-sm text-[#efeae0]/70 underline-offset-4 hover:text-[#efeae0] hover:underline"
              >
                Menu
              </Link>
            </div>
            {offMenu.length ? (
              <ul className="mt-4 space-y-3">
                {offMenu.map((item) => (
                  <li key={item.id}>
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-lg">{item.name}</span>
                      <span className="menu-leader" />
                      <span className="rounded bg-[#9c3d30] px-1.5 py-0.5 text-[11px] font-bold tracking-widest text-white uppercase">
                        Not available
                      </span>
                    </div>
                    {item.alternative ? (
                      <p className="mt-0.5 text-sm text-[#efeae0]/70 italic">
                        Offer: {item.alternative}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[#efeae0]/80">
                {menuItems.length
                  ? "Everything on the menu can be made."
                  : "Link menu items to machines to see what's affected when one breaks."}
              </p>
            )}
          </section>

          {isOwner && !setupComplete ? (
            <section className={`${cardClasses} rounded-lg p-5`}>
              <h2 className="font-display text-xl font-semibold">
                Finish setting up
              </h2>
              <ol className="mt-4 space-y-1">
                {setupSteps.map((step) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="flex min-h-10 items-center gap-3 rounded-md px-2 hover:bg-subtle"
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                          step.done
                            ? "border-success bg-success text-white"
                            : "border-border-strong bg-white"
                        }`}
                      >
                        {step.done ? <CheckIcon className="size-3.5" /> : null}
                      </span>
                      <span
                        className={`text-sm ${step.done ? "text-muted line-through" : "font-medium"}`}
                      >
                        {step.label}
                      </span>
                      <span className="sr-only">
                        {step.done ? "(done)" : "(to do)"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
