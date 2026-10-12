"use server";

import { revalidatePath } from "next/cache";

import {
  readConditionChoice,
  setEquipmentConditionFor,
} from "@/lib/modules/equipment/mark-unavailable";
import { isUuid } from "@/lib/modules/equipment/validation";
import { mapTeamError } from "@/lib/modules/team/errors";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export type ReviewState = {
  error?: string;
};

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function revalidateReports() {
  revalidatePath("/reports");
  revalidatePath("/tickets");
  revalidatePath("/today");
}

export async function acceptReport(
  _state: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const membership = await requireOwner();
  const reportId = formData.get("reportId")?.toString() ?? "";
  const priority = formData.get("priority")?.toString() ?? "";
  // "keep" (or nothing) leaves the machine as it is.
  const newCondition = readConditionChoice(formData.get("condition"));

  if (
    !isUuid(reportId) ||
    !PRIORITIES.includes(priority as (typeof PRIORITIES)[number])
  ) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_public_report", {
    p_organization_id: membership.organizationId,
    p_report_id: reportId,
    p_priority: priority,
  });

  if (error) {
    return {
      error: mapTeamError(
        "accept_public_report",
        error,
        "We could not accept this report.",
      ),
    };
  }

  if (newCondition) {
    const { data: report } = await supabase
      .from("public_reports")
      .select("equipment_id")
      .eq("organization_id", membership.organizationId)
      .eq("id", reportId)
      .single();

    const marked = report
      ? await setEquipmentConditionFor(
          supabase,
          membership.organizationId,
          report.equipment_id,
          newCondition,
        )
      : false;

    revalidateReports();
    revalidatePath("/menu-impact");
    revalidatePath("/equipment");

    if (!marked) {
      return {
        error:
          "The ticket was created, but the machine condition could not be changed. Change it on the equipment page.",
      };
    }

    return {};
  }

  revalidateReports();
  return {};
}

export async function dismissReport(
  _state: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const membership = await requireOwner();
  const reportId = formData.get("reportId")?.toString() ?? "";

  if (!isUuid(reportId)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_public_report", {
    p_organization_id: membership.organizationId,
    p_report_id: reportId,
  });

  if (error) {
    return {
      error: mapTeamError(
        "dismiss_public_report",
        error,
        "We could not dismiss this report.",
      ),
    };
  }

  revalidateReports();
  return {};
}
