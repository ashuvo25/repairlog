import type { Metadata } from "next";
import Link from "next/link";

import { BackLink, PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isUuid } from "@/lib/modules/equipment/validation";
import { requireMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import { NewTicketForm } from "../ticket-form";

export const metadata: Metadata = {
  title: "Report a fault",
};

export default async function NewTicketPage({
  searchParams,
}: PageProps<"/tickets/new">) {
  const membership = await requireMembership();
  const requested = (await searchParams).equipment;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipment")
    .select("id, name, category")
    .eq("organization_id", membership.organizationId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load equipment.");
  }

  const equipment = (data ?? []) as { id: string; name: string; category: string }[];
  const selected =
    typeof requested === "string" &&
    isUuid(requested) &&
    equipment.some((item) => item.id === requested)
      ? requested
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-8 sm:py-8">
      <BackLink href="/tickets">Back to tickets</BackLink>
      <div className="mt-4">
        <PageHeader
          title="Report a fault"
          description="Create a ticket so the problem is tracked until it is fixed."
        />
      </div>
      <Card className="mt-8">
        {equipment.length ? (
          <NewTicketForm
            equipment={equipment}
            selectedEquipmentId={selected}
            isOwner={membership.role === "owner"}
          />
        ) : (
          <div className="py-6 text-center">
            <p className="leading-7 text-muted">
              Add a machine before reporting a fault.
            </p>
            <Link href="/equipment" className={`mt-4 ${buttonClasses()}`}>
              Open equipment
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
