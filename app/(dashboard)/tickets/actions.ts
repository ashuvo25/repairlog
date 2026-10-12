"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  readConditionChoice,
  setEquipmentConditionFor,
} from "@/lib/modules/equipment/mark-unavailable";
import {
  isUuid,
  parseVersion,
} from "@/lib/modules/equipment/validation";
import {
  isTicketPriority,
  isTicketStatus,
  parseAmountToMinor,
  todayInTimezone,
} from "@/lib/modules/tickets/constants";
import {
  requireMembership,
  requireOwner,
} from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export type TicketActionState = {
  error?: string;
  success?: string;
};

type RpcError = { code: string; message: string };

const MESSAGES: Record<string, string> = {
  "40001": "This ticket changed in another tab. Refresh and try again.",
  "42501": "You do not have permission to do this.",
  "22023": "Some of the details are not valid. Check them and try again.",
  P0002: "This item no longer exists. Refresh the page and try again.",
  RL030: "That status change is not possible from the current status.",
  RL031: "Only an owner can confirm that a repair is resolved.",
  RL032: "This ticket is resolved. Reopen it before making changes.",
};

function mapError(scope: string, error: RpcError, fallback: string) {
  console.error(`${scope} failed`, { code: error.code, message: error.message });

  if (MESSAGES[error.code]) {
    return MESSAGES[error.code];
  }

  if (process.env.NODE_ENV === "development") {
    return error.code === "PGRST202"
      ? "The ticket database functions are not installed yet. Run database/980_tickets_module.sql."
      : `Database error ${error.code}: ${error.message}`;
  }

  return fallback;
}

function revalidateTicket(ticketId?: string) {
  revalidatePath("/tickets");
  revalidatePath("/today");

  if (ticketId) {
    revalidatePath(`/tickets/${ticketId}`);
  }
}

export async function createTicket(
  _state: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const membership = await requireMembership();
  const requestId = formData.get("requestId")?.toString() ?? "";
  const equipmentId = formData.get("equipmentId")?.toString() ?? "";
  const priority = formData.get("priority")?.toString() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";

  if (!isUuid(requestId)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  if (!isUuid(equipmentId)) {
    return { error: "Choose the equipment that has the problem." };
  }

  if (!isTicketPriority(priority)) {
    return { error: "Choose a priority." };
  }

  if (description.length < 1 || description.length > 4000) {
    return { error: "Describe the problem in 1 to 4000 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_ticket", {
    p_organization_id: membership.organizationId,
    p_request_id: requestId,
    p_equipment_id: equipmentId,
    p_priority: priority,
    p_description: description,
  });

  if (error) {
    return { error: mapError("create_ticket", error, "We could not create the ticket.") };
  }

  const ticketId = typeof data === "string" ? data : "";
  if (!isUuid(ticketId)) {
    return { error: "The ticket was created but could not be opened." };
  }

  // Only an owner may confirm a machine is down; staff tickets leave the
  // condition for the owner to check.
  const newCondition = readConditionChoice(formData.get("condition"));
  if (membership.role === "owner" && newCondition) {
    await setEquipmentConditionFor(supabase, membership.organizationId, equipmentId, newCondition);
    revalidatePath("/menu-impact");
    revalidatePath("/equipment");
  }

  revalidateTicket(ticketId);
  redirect(`/tickets/${ticketId}`);
}

export async function changeTicketStatus(
  _state: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const membership = await requireMembership();
  const ticketId = formData.get("ticketId")?.toString() ?? "";
  const version = parseVersion(formData.get("version"));
  const status = formData.get("status")?.toString() ?? "";

  if (!isUuid(ticketId) || version === null || !isTicketStatus(status)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ticket_status", {
    p_organization_id: membership.organizationId,
    p_ticket_id: ticketId,
    p_expected_version: version,
    p_status: status,
  });

  if (error) {
    return {
      error: mapError("set_ticket_status", error, "We could not update the ticket."),
    };
  }

  revalidateTicket(ticketId);
  return {};
}

export async function reopenTicket(
  _state: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const membership = await requireOwner();
  const ticketId = formData.get("ticketId")?.toString() ?? "";
  const version = parseVersion(formData.get("version"));
  const reason = formData.get("reason")?.toString().trim() ?? "";

  if (!isUuid(ticketId) || version === null) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  if (reason.length < 1 || reason.length > 1000) {
    return { error: "Give a short reason for reopening this ticket." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_ticket", {
    p_organization_id: membership.organizationId,
    p_ticket_id: ticketId,
    p_expected_version: version,
    p_reason: reason,
  });

  if (error) {
    return {
      error: mapError("reopen_ticket", error, "We could not reopen the ticket."),
    };
  }

  revalidateTicket(ticketId);
  return {};
}

export async function addRepairUpdate(
  _state: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const membership = await requireOwner();
  const ticketId = formData.get("ticketId")?.toString() ?? "";
  const requestId = formData.get("requestId")?.toString() ?? "";
  const technicianName = formData.get("technicianName")?.toString().trim() ?? "";
  const workNote = formData.get("workNote")?.toString().trim() ?? "";
  const workDate = formData.get("workDate")?.toString() ?? "";
  const cost = parseAmountToMinor(formData.get("cost")?.toString() ?? "");

  if (!isUuid(ticketId) || !isUuid(requestId)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  if (workNote.length < 1 || workNote.length > 4000) {
    return { error: "Describe the work done in 1 to 4000 characters." };
  }

  if (technicianName.length > 120) {
    return { error: "Keep the technician name under 120 characters." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { error: "Choose the date the work was done." };
  }

  if (cost === undefined) {
    return { error: "Enter the cost as a number, such as 45 or 45.50." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_repair_update", {
    p_organization_id: membership.organizationId,
    p_ticket_id: ticketId,
    p_request_id: requestId,
    p_technician_name: technicianName,
    p_work_note: workNote,
    p_work_date: workDate,
    p_cost_minor: cost,
  });

  if (error) {
    return {
      error: mapError("add_repair_update", error, "We could not save the repair work."),
    };
  }

  revalidateTicket(ticketId);
  return { success: "Repair work recorded." };
}

// The owner's final step: confirm the repair, and optionally record in the
// same click that the machine is working again.
export async function confirmFixed(
  _state: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const membership = await requireOwner();
  const ticketId = formData.get("ticketId")?.toString() ?? "";
  const version = parseVersion(formData.get("version"));
  const requestId = formData.get("requestId")?.toString() ?? "";
  const cost = parseAmountToMinor(formData.get("cost")?.toString() ?? "");
  const note = formData.get("workNote")?.toString().trim() ?? "";

  if (!isUuid(ticketId) || version === null || !isUuid(requestId)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  // The repair cost is required to close a ticket; 0 means it was free.
  if (cost === null || cost === undefined) {
    return { error: "Enter the repair cost, such as 45 or 45.50. Enter 0 if it was free." };
  }

  if (note.length > 4000) {
    return { error: "Keep the note under 4000 characters." };
  }

  const supabase = await createClient();
  const { data: ticketRow } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", membership.organizationId)
    .single();
  const { error: costError } = await supabase.rpc("add_repair_update", {
    p_organization_id: membership.organizationId,
    p_ticket_id: ticketId,
    p_request_id: requestId,
    p_technician_name: "",
    p_work_note: note || "Repair checked and confirmed by the owner.",
    p_work_date: todayInTimezone(ticketRow?.timezone ?? "UTC"),
    p_cost_minor: cost,
  });

  if (costError) {
    return {
      error: mapError("add_repair_update", costError, "We could not save the repair cost."),
    };
  }

  const { error } = await supabase.rpc("set_ticket_status", {
    p_organization_id: membership.organizationId,
    p_ticket_id: ticketId,
    p_expected_version: version,
    p_status: "resolved",
  });

  if (error) {
    return { error: mapError("set_ticket_status", error, "We could not close the ticket.") };
  }

  {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("equipment_id")
      .eq("organization_id", membership.organizationId)
      .eq("id", ticketId)
      .single();
    const { data: equipment } = ticket
      ? await supabase
          .from("equipment")
          .select("id, version, condition, archived_at")
          .eq("organization_id", membership.organizationId)
          .eq("id", ticket.equipment_id)
          .single()
      : { data: null };

    // Another unfixed ticket on the same machine keeps it Unavailable.
    const { count: otherOpen } = ticket
      ? await supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", membership.organizationId)
          .eq("equipment_id", ticket.equipment_id)
          .neq("status", "resolved")
      : { count: 0 };

    if (
      equipment &&
      !equipment.archived_at &&
      equipment.condition !== "operational" &&
      (otherOpen ?? 0) === 0
    ) {
      const { error: conditionError } = await supabase.rpc("set_equipment_condition", {
        p_organization_id: membership.organizationId,
        p_equipment_id: equipment.id,
        p_expected_version: equipment.version,
        p_condition: "operational",
      });

      if (conditionError) {
        revalidateTicket(ticketId);
        return {
          error:
            "The ticket is fixed, but the machine's condition could not be updated. Change it on the equipment page.",
        };
      }

      revalidatePath(`/equipment/${equipment.id}`);
      revalidatePath("/equipment");
      revalidatePath("/menu-impact");
    }
  }

  revalidateTicket(ticketId);
  return {};
}
