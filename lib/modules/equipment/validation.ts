export const EQUIPMENT_CATEGORIES = [
  "Coffee",
  "Refrigeration",
  "Cooking",
  "Cleaning",
  "Water",
  "Electrical",
  "Other",
] as const;

export const EQUIPMENT_CONDITIONS = [
  "operational",
  "unavailable",
  "unknown",
] as const;

export type EquipmentCondition = (typeof EQUIPMENT_CONDITIONS)[number];

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function validateEquipmentText(name: string, category: string) {
  if (name.length < 1 || name.length > 120) {
    return "Equipment name must be between 1 and 120 characters.";
  }

  if (category.length < 1 || category.length > 80) {
    return "Category must be between 1 and 80 characters.";
  }

  return null;
}

export function parseVersion(value: FormDataEntryValue | null) {
  const version = Number(value?.toString());

  if (!Number.isInteger(version) || version < 1) {
    return null;
  }

  return version;
}

export function isEquipmentCondition(
  value: string,
): value is EquipmentCondition {
  return EQUIPMENT_CONDITIONS.includes(value as EquipmentCondition);
}
