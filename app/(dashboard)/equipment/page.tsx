import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Tip } from "@/components/onboarding/tip";
import { Badge, ConditionBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { StatCard, cardClasses } from "@/components/ui/card";
import { ArrowRightIcon, PlusIcon } from "@/components/ui/icons";
import { pluralize } from "@/lib/format";
import type { EquipmentCondition } from "@/lib/modules/equipment/conditions";
import { requireMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export const metadata: Metadata = {
  title: "Equipment",
};

type EquipmentRow = {
  id: string;
  name: string;
  category: string;
  condition: EquipmentCondition;
  archived_at: string | null;
  updated_at: string;
};

function EquipmentCard({ item }: Readonly<{ item: EquipmentRow }>) {
  return (
    <Link
      href={`/equipment/${item.id}`}
      className={`group ${cardClasses} flex flex-col p-5 transition-colors hover:border-border-strong`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-tight">
            {item.name}
          </h3>
          <p className="mt-1 text-sm text-muted">{item.category}</p>
        </div>
        <ConditionBadge condition={item.condition} />
      </div>
      <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:underline">
        View details
        <ArrowRightIcon />
      </p>
    </Link>
  );
}

export default async function EquipmentPage() {
  const membership = await requireMembership();
  const supabase = await createClient();

  const [{ data: organization }, { data, error }] = await Promise.all([
    supabase
      .from("organizations")
      .select("name")
      .eq("id", membership.organizationId)
      .single(),
    supabase
      .from("equipment")
      .select("id, name, category, condition, archived_at, updated_at")
      .eq("organization_id", membership.organizationId)
      .order("updated_at", { ascending: false }),
  ]);

  if (error) {
    throw new Error("Unable to load equipment.");
  }

  const equipment = (data ?? []) as EquipmentRow[];
  const active = equipment.filter((item) => !item.archived_at);
  const archived = equipment.filter((item) => item.archived_at);
  const isOwner = membership.role === "owner";

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow={organization?.name ?? "Your café"}
        title="Equipment"
        description="The machines your team uses every day, their confirmed condition, and their QR labels."
        actions={
          isOwner ? (
            <Link href="/equipment/new" className={buttonClasses()}>
              <PlusIcon />
              Add equipment
            </Link>
          ) : null
        }
      />

      {isOwner ? (
        <div className="mt-6">
          <Tip tipKey="equipment" />
        </div>
      ) : null}

      <section
        aria-label="Equipment summary"
        className="mt-8 grid gap-4 sm:grid-cols-3"
      >
        <StatCard label="Active machines" value={active.length} />
        <StatCard
          label="Operational"
          value={
            active.filter((item) => item.condition === "operational").length
          }
        />
        <StatCard
          label="Needs confirmation"
          value={active.filter((item) => item.condition === "unknown").length}
        />
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Active equipment
          </h2>
          <span className="text-sm text-muted">
            {pluralize(active.length, "machine", "machines")}
          </span>
        </div>

        {active.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {active.map((item) => (
              <EquipmentCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
            <h3 className="text-lg font-semibold">No equipment yet</h3>
            <p className="mx-auto mt-2 max-w-md leading-7 text-muted">
              Add your first machine to start tracking its condition, QR
              reports and repair history.
            </p>
            {isOwner ? (
              <Link
                href="/equipment/new"
                className={`mt-6 ${buttonClasses()}`}
              >
                <PlusIcon />
                Add your first machine
              </Link>
            ) : (
              <p className="mt-4 text-sm font-medium text-muted">
                Ask an owner to add the first machine.
              </p>
            )}
          </div>
        )}
      </section>

      {archived.length ? (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-semibold tracking-tight">
            Archived equipment
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {archived.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/equipment/${item.id}`}
                  className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-subtle px-4 py-3 hover:border-border-strong"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {item.name}
                    </span>
                    <span className="block text-sm text-muted">
                      {item.category}
                    </span>
                  </span>
                  <Badge>Archived</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
