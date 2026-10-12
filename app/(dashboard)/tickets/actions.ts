"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isUuid,
  parseVersion,
} from "@/lib/modules/equipment/validation";
import {
  isTicketPriority,
  isTicketStatus,
  parseAmountToMinor,
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
