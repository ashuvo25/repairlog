import type { SupabaseClient } from "@supabase/supabase-js";

import { isEquipmentCondition, type EquipmentCondition } from "./validation";

// The value of a "machine condition" choice on a form: either a condition
// or "keep" to leave the machine as it is.
export function readConditionChoice(value: FormDataEntryValue | null): EquipmentCondition | null {
  const text = value?.toString() ?? "keep";
  return isEquipmentCondition(text) ? text : null;
}

// Owner-confirmed machine condition. Goes through the same owner-only,
// version-checked database function as the equipment page, so menu items
// update straight away. Returns false if it could not be set.
export async function setEquipmentConditionFor(
  supabase: SupabaseClient,
  organizationId: string,
  equipmentId: string,
  condition: EquipmentCondition,
) {
  const { data: equipment } = await supabase
    .from("equipment")
    .select("id, version, condition, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", equipmentId)
    .maybeSingle();

  if (!equipment || equipment.archived_at) {
    return false;
  }

  if (equipment.condition === condition) {
    return true;
  }

  const { error } = await supabase.rpc("set_equipment_condition", {
    p_organization_id: organizationId,
    p_equipment_id: equipment.id,
    p_expected_version: equipment.version,
    p_condition: condition,
  });

  return !error;
}
