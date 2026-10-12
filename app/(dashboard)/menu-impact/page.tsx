import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Tip } from "@/components/onboarding/tip";
import { Badge, ConditionBadge } from "@/components/ui/badge";
import { Card, StatCard, cardClasses } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import {
  loadMenuImpact,
  MENU_STATUS_LABELS,
  type MenuItemStatus,
} from "@/lib/modules/menu-impact/status";
import { requireMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import { ArchiveMenuItemButton, MenuItemForm } from "./menu-item-form";

export const metadata: Metadata = {
  title: "Menu impact",
};

// Affected items first, so the team sees what to stop selling.
const STATUS_ORDER: Record<MenuItemStatus, number> = {
  affected: 0,
  unknown: 1,
  not_configured: 2,
  available: 3,
};

export default async function MenuImpactPage() {
  const membership = await requireMembership();
  const isOwner = membership.role === "owner";
  const supabase = await createClient();

  const [items, machinesResult] = await Promise.all([
    loadMenuImpact(supabase, membership.organizationId),
    supabase
      .from("equipment")
      .select("id, name, category")
      .eq("organization_id", membership.organizationId)
      .is("archived_at", null)
      .order("name", { ascending: true }),
  ]);

  const machines = (machinesResult.data ?? []) as {
    id: string;
    name: string;
    category: string;
  }[];
  const sorted = [...items].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );
  // Group by machine: each machine with the menu items that need it.
  // An item that needs two machines appears under both.
  type Group = {
    id: string;
    name: string;
    condition: (typeof items)[number]["equipment"][number]["condition"];
    openFaults: number;
    items: typeof items;
  };
  const groupMap = new Map<string, Group>();
  for (const item of sorted) {
    for (const machine of item.equipment) {
      const group = groupMap.get(machine.id) ?? {
        id: machine.id,
        name: machine.name,
        condition: machine.condition,
        openFaults: machine.openFaults,
        items: [],
      };
      group.items.push(item);
      groupMap.set(machine.id, group);
    }
  }
  const conditionOrder = { unavailable: 0, unknown: 1, operational: 2 } as const;
  const groups: Group[] = [...groupMap.values()].sort(
    (a, b) =>
      (a.condition ? conditionOrder[a.condition] : 3) - (b.condition ? conditionOrder[b.condition] : 3) ||
      a.name.localeCompare(b.name),
  );
  const unlinked = sorted.filter((item) => item.equipment.length === 0);
  if (unlinked.length) {
    groups.push({
      id: "unlinked",
      name: "Not linked to a machine",
      condition: null,
      openFaults: 0,
      items: unlinked,
    });
  }
  const affected = items.filter((item) => item.status === "affected").length;
  const unknown = items.filter((item) => item.status === "unknown").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Menu impact"
        description="Which menu items you can serve right now, based on the confirmed condition of the machines they need."
      />

      {isOwner ? (
        <div className="mt-6">
          <Tip tipKey="menu_links" />
        </div>
      ) : null}

      <section
        aria-label="Menu summary"
        className="mt-8 grid gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Affected"
          value={affected}
          help="A needed machine is unavailable."
        />
        <StatCard
          label="Unknown"
          value={unknown}
          help="A needed machine is not confirmed."
        />
        <StatCard label="Menu items" value={items.length} />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section>
          <h2 className="font-display text-xl font-semibold tracking-tight">By machine</h2>
          <p className="mt-1 text-sm text-muted">
            Each machine and the menu items that need it.
          </p>
          {groups.length ? (
            <ul className="mt-4 space-y-3">
              {groups.map((group) => (
                <li key={group.id} className={`${cardClasses} overflow-hidden`}>
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-subtle px-5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{group.name}</span>
                      <span className="block text-xs text-muted">Machine</span>
                    </span>
                    {group.condition ? (
                      <ConditionBadge condition={group.condition} />
                    ) : (
                      <Badge>{group.id === "unlinked" ? "No machine" : "Archived"}</Badge>
                    )}
                  </div>
                  {group.openFaults > 0 && group.condition !== "unavailable" ? (
                    <a
                      href={`/equipment/${group.id}`}
                      className="flex items-center justify-between gap-3 border-b border-attention-border bg-attention-soft px-5 py-2.5 text-sm text-attention hover:underline"
                    >
                      <span>
                        <span className="font-semibold">Fault reported.</span> This
                        machine is still marked {group.condition === "operational" ? "working" : "unchecked"}.
                        Confirm its condition so the menu is right.
                      </span>
                      <span aria-hidden="true">→</span>
                    </a>
                  ) : null}
                  <ul className="divide-y divide-border">
                    {group.items.map((item) => (
                      <li key={item.id} className="px-5 py-3 pl-9">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate">{item.name}</span>
                          <Badge tone={MENU_STATUS_LABELS[item.status].tone}>
                            {MENU_STATUS_LABELS[item.status].label}
                          </Badge>
                        </div>
                        {item.status === "affected" && item.alternative ? (
                          <p className="mt-1 text-sm text-attention">
                            Offer instead: {item.alternative}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center leading-7 text-muted">
              {isOwner
                ? "No menu items yet. Add one and choose the machines needed to make it."
                : "No menu items have been set up yet."}
            </p>
          )}
        </section>

        {isOwner ? (
          <div className="space-y-6">
            <Card
              title="Add a menu item"
              description="Choose the machines needed to make it."
            >
              <MenuItemForm machines={machines} />
            </Card>

            {sorted.length ? (
              <Card title="Edit menu items">
                <ul className="divide-y divide-border">
                  {sorted.map((item) => (
                    <li key={item.id} className="py-1">
                      <details className="group">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                          <span className="truncate font-medium">{item.name}</span>
                          <span className="text-sm font-semibold text-primary group-open:hidden">Edit</span>
                          <span className="hidden text-sm font-semibold text-muted group-open:inline">Close</span>
                        </summary>
                        <div className="space-y-5 pt-2 pb-4">
                          <MenuItemForm
                            machines={machines}
                            item={{
                              id: item.id,
                              name: item.name,
                              alternative: item.alternative,
                              updatedAt: item.updatedAt,
                              equipmentIds: item.equipment.map((machine) => machine.id),
                            }}
                          />
                          <div className="border-t border-border pt-4">
                            <ArchiveMenuItemButton menuItemId={item.id} name={item.name} />
                          </div>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        ) : (
          <FormMessage tone="success">
            A menu item shows Affected when a machine it needs is confirmed
            unavailable. Ask an owner if something looks wrong.
          </FormMessage>
        )}
      </div>
    </main>
  );
}
