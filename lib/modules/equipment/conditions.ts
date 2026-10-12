import type { EquipmentCondition } from "./validation";

export type { EquipmentCondition };

export const CONDITION_LABELS: Record<EquipmentCondition, string> = {
  operational: "Operational",
  unavailable: "Unavailable",
  unknown: "Unknown",
};
