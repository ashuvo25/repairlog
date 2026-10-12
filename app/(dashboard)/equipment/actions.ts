"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isEquipmentCondition,
  isUuid,
  parseVersion,
  validateEquipmentText,
} from "@/lib/modules/equipment/validation";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export type EquipmentActionState = {
  error?: string;
  success?: string;
};

type RpcError = {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

function mapEquipmentError(error: RpcError, fallback: string) {
  console.error("Equipment RPC failed", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  if (error.code === "40001") {
    return "This equipment changed in another tab. Refresh and try again.";
  }

  if (error.code === "42501") {
    return "Only an active owner can perform this action.";
  }

  if (error.code === "P0002") {
    return "The equipment was not found or is already archived.";
  }

  if (process.env.NODE_ENV === "development") {
    if (error.code === "PGRST202") {
      return "The equipment database functions are not installed yet. Run database/940_equipment_module.sql.";
    }

    return `Database error ${error.code}: ${error.message}`;
  }

  return fallback;
}

function readEquipmentFields(formData: FormData) {
  return {
    name: formData.get("name")?.toString().trim() ?? "",
    category: formData.get("category")?.toString().trim() ?? "",
  };
}

function revalidateEquipment(equipmentId?: string) {
  revalidatePath("/equipment");
  revalidatePath("/today");

  if (equipmentId) {
    revalidatePath(`/equipment/${equipmentId}`);
  }
}

export async function createEquipment(
  _state: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const membership = await requireOwner();
  const requestId = formData.get("requestId")?.toString() ?? "";
  const { name, category } = readEquipmentFields(formData);

  if (!isUuid(requestId)) {
    return { error: "The create request is invalid. Refresh and try again." };
  }

  const validationError = validateEquipmentText(name, category);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_equipment", {
    p_organization_id: membership.organizationId,
    p_request_id: requestId,
    p_name: name,
    p_category: category,
  });

  if (error) {
    return {
      error: mapEquipmentError(error, "We could not create the equipment."),
    };
  }

  const equipmentId = typeof data === "string" ? data : "";
  if (!isUuid(equipmentId)) {
    return { error: "The equipment was created but its ID was not returned." };
  }

  revalidateEquipment(equipmentId);
  redirect(`/equipment/${equipmentId}`);
}

export async function updateEquipment(
  equipmentId: string,
  _state: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const membership = await requireOwner();
  const version = parseVersion(formData.get("version"));
  const { name, category } = readEquipmentFields(formData);

  if (!isUuid(equipmentId) || version === null) {
    return { error: "The equipment update request is invalid." };
  }

  const validationError = validateEquipmentText(name, category);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_equipment", {
    p_organization_id: membership.organizationId,
    p_equipment_id: equipmentId,
    p_expected_version: version,
    p_name: name,
    p_category: category,
  });

  if (error) {
    return {
      error: mapEquipmentError(error, "We could not update the equipment."),
    };
  }

  revalidateEquipment(equipmentId);
  return { success: "Equipment details updated." };
}

export async function changeEquipmentCondition(
  equipmentId: string,
  _state: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const membership = await requireOwner();
  const version = parseVersion(formData.get("version"));
  const condition = formData.get("condition")?.toString() ?? "";

  if (
    !isUuid(equipmentId) ||
    version === null ||
    !isEquipmentCondition(condition)
  ) {
    return { error: "The condition update request is invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_equipment_condition", {
    p_organization_id: membership.organizationId,
    p_equipment_id: equipmentId,
    p_expected_version: version,
    p_condition: condition,
  });

  if (error) {
    return {
      error: mapEquipmentError(error, "We could not update the condition."),
    };
  }

  revalidateEquipment(equipmentId);
  return { success: "Equipment condition confirmed." };
}

export async function rotateEquipmentQrCode(
  equipmentId: string,
  _state: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const membership = await requireOwner();
  const version = parseVersion(formData.get("version"));

  if (!isUuid(equipmentId) || version === null) {
    return { error: "The QR-code request is invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_equipment_public_code", {
    p_organization_id: membership.organizationId,
    p_equipment_id: equipmentId,
    p_expected_version: version,
  });

  if (error) {
    return {
      error: mapEquipmentError(error, "We could not replace the QR code."),
    };
  }

  revalidateEquipment(equipmentId);
  return { success: "A new QR code was created. The previous code is revoked." };
}

export async function archiveEquipment(
  equipmentId: string,
  _state: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const membership = await requireOwner();
  const version = parseVersion(formData.get("version"));

  if (!isUuid(equipmentId) || version === null) {
    return { error: "The archive request is invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_equipment", {
    p_organization_id: membership.organizationId,
    p_equipment_id: equipmentId,
    p_expected_version: version,
  });

  if (error) {
    return {
      error: mapEquipmentError(error, "We could not archive the equipment."),
    };
  }

  revalidateEquipment(equipmentId);
  redirect("/equipment");
}
