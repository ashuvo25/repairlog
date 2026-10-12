import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import { OrganizationSettingsForm } from "./organization-settings-form";

export const metadata: Metadata = {
  title: "Café details",
};

export default async function OrganizationSettingsPage() {
  const membership = await requireOwner();
  const supabase = await createClient();
  const [{ data: organization, error }, { data: location }] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, currency, timezone")
      .eq("id", membership.organizationId)
      .single(),
    supabase
      .from("locations")
      .select("name")
      .eq("organization_id", membership.organizationId)
      .maybeSingle(),
  ]);

  if (error || !organization) {
    throw new Error("Unable to load café details.");
  }

  return (
    <Card
      title="Café details"
      description="The basics your team sees every day."
    >
      <OrganizationSettingsForm
        name={organization.name}
        locationName={location?.name ?? ""}
        timezone={organization.timezone}
        currency={organization.currency}
      />
    </Card>
  );
}
