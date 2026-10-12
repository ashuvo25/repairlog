"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/modules/equipment/validation";
import { isValidTimezone } from "@/lib/modules/organizations/timezones";
import { mapTeamError } from "@/lib/modules/team/errors";
import { createClient } from "@/lib/supabase/server/client";

export type CreateOrganizationState = {
  error?: string;
};

export async function createOrganization(
  _state: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  await requireAuthenticatedUser();

  const requestId = formData.get("requestId")?.toString() ?? "";
  const name = formData.get("name")?.toString().trim() ?? "";
  const locationName = formData.get("locationName")?.toString().trim() ?? "";
  const currency = formData.get("currency")?.toString().trim().toUpperCase() ?? "";
  const timezone = formData.get("timezone")?.toString().trim() ?? "";

  if (!isUuid(requestId)) {
    return { error: "The setup request is invalid. Refresh and try again." };
  }

  if (name.length < 1 || name.length > 120) {
    return { error: "Café name must be between 1 and 120 characters." };
  }

  if (locationName.length < 1 || locationName.length > 120) {
    return { error: "Location name must be between 1 and 120 characters." };
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "Choose a valid three-letter currency." };
  }

  if (!isValidTimezone(timezone)) {
    return { error: "Choose a valid café timezone." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_request_id: requestId,
    p_name: name,
    p_currency: currency,
    p_timezone: timezone,
    p_location_name: locationName,
  });

  if (error) {
    return {
      error: mapTeamError(
        "create_organization",
        error,
        "We could not create the café. Please try again.",
      ),
    };
  }

  revalidatePath("/", "layout");
  redirect("/today");
}
