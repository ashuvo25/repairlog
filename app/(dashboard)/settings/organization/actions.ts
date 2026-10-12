"use server";

import { revalidatePath } from "next/cache";

import { isValidTimezone } from "@/lib/modules/organizations/timezones";
import { mapTeamError } from "@/lib/modules/team/errors";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export type OrganizationSettingsState = {
  error?: string;
  success?: string;
};

export async function updateOrganization(
  _state: OrganizationSettingsState,
  formData: FormData,
): Promise<OrganizationSettingsState> {
  const membership = await requireOwner();
  const name = formData.get("name")?.toString().trim() ?? "";
  const locationName = formData.get("locationName")?.toString().trim() ?? "";
  const timezone = formData.get("timezone")?.toString().trim() ?? "";

  if (name.length < 1 || name.length > 120) {
    return { error: "Café name must be between 1 and 120 characters." };
  }

  if (locationName.length < 1 || locationName.length > 120) {
    return { error: "Location name must be between 1 and 120 characters." };
  }

  if (!isValidTimezone(timezone)) {
    return { error: "Choose a valid café timezone." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization", {
    p_organization_id: membership.organizationId,
    p_name: name,
    p_location_name: locationName,
    p_timezone: timezone,
  });

  if (error) {
    return {
      error: mapTeamError(
        "update_organization",
        error,
        "We could not save the café details.",
      ),
    };
  }

  // The café name appears across the workspace.
  revalidatePath("/", "layout");
  return { success: "Café details saved." };
}
