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
          <h2 className="text-xl font-semibold tracking-tight">Menu items</h2>
          {sorted.length ? (
            <ul className="mt-4 space-y-3">
              {sorted.map((item) => (
                <li key={item.id} className={`${cardClasses} p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {item.name}
                    </h3>
                    <Badge tone={MENU_STATUS_LABELS[item.status].tone}>
                      {MENU_STATUS_LABELS[item.status].label}
                    </Badge>
                  </div>

                  {item.status === "affected" && item.alternative ? (
                    <p className="mt-3 rounded-lg border border-attention-border bg-attention-soft px-4 py-3 text-sm leading-6 text-attention">
                      <span className="font-semibold">Offer instead:</span>{" "}
                      {item.alternative}
                    </p>
                  ) : null}

                  {item.equipment.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {item.equipment.map((machine) => (
                        <li
                          key={machine.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm"
                        >
                          {machine.name}
                          {machine.condition ? (
                            <ConditionBadge condition={machine.condition} />
                          ) : (
                            <Badge>Archived</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      No machines linked yet.
                    </p>
                  )}

                  {isOwner ? (
                    <details className="mt-4 border-t border-border pt-3">
                      <summary className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                        Edit item
                      </summary>
                      <div className="mt-3 space-y-5">
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
                          <ArchiveMenuItemButton
                            menuItemId={item.id}
                            name={item.name}
                          />
                        </div>
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center leading-7 text-muted">
              {isOwner
                ? "No menu items yet. Add one and link the machines needed to prepare it."
                : "No menu items have been set up yet."}
            </p>
          )}
        </section>

        {isOwner ? (
          <Card
            title="Add a menu item"
            description="Link the machines needed to prepare this item."
          >
            <MenuItemForm machines={machines} />
          </Card>
        ) : (
          <FormMessage tone="success">
            Menu items show Affected when a machine they need is confirmed
            unavailable. Ask an owner if something looks wrong.
          </FormMessage>
        )}
      </div>
    </main>
  );
}
