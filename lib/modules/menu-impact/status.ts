import type { SupabaseClient } from "@supabase/supabase-js";

import type { EquipmentCondition } from "@/lib/modules/equipment/conditions";

export type MenuItemStatus = "available" | "affected" | "unknown" | "not_configured";

export const MENU_STATUS_LABELS: Record<
  MenuItemStatus,
  { label: string; tone: "positive" | "attention" | "danger" | "neutral" }
> = {
  available: { label: "Available", tone: "positive" },
  affected: { label: "Affected", tone: "danger" },
  unknown: { label: "Unknown", tone: "attention" },
  not_configured: { label: "Not configured", tone: "neutral" },
};

// The launch rule from the plan: every linked machine must be confirmed
// operational for Available; any unavailable machine makes the item
// Affected; anything else stays Unknown rather than guessing.
export function getMenuItemStatus(
  linkedConditions: readonly (EquipmentCondition | null)[],
): MenuItemStatus {
  if (linkedConditions.length === 0) {
    return "not_configured";
  }

  if (linkedConditions.includes("unavailable")) {
    return "affected";
  }

  if (linkedConditions.every((condition) => condition === "operational")) {
    return "available";
  }

  return "unknown";
}

export type MenuImpactItem = {
  id: string;
  name: string;
  alternative: string | null;
  updatedAt: string;
  status: MenuItemStatus;
  equipment: { id: string; name: string; condition: EquipmentCondition | null }[];
};

// Loads every active menu item with its linked machines and derived status.
export async function loadMenuImpact(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<MenuImpactItem[]> {
  const [itemsResult, dependenciesResult, equipmentResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, name, approved_alternative, updated_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    supabase
      .from("menu_dependencies")
      .select("menu_item_id, equipment_id")
      .eq("organization_id", organizationId),
    supabase
      .from("equipment")
      .select("id, name, condition, archived_at")
      .eq("organization_id", organizationId),
  ]);

  if (itemsResult.error || dependenciesResult.error || equipmentResult.error) {
    throw new Error("Unable to load menu impact.");
  }

  const equipment = new Map(
    (
      equipmentResult.data as {
        id: string;
        name: string;
        condition: EquipmentCondition;
        archived_at: string | null;
      }[]
    ).map((item) => [item.id, item]),
  );
  const links = new Map<string, string[]>();
  for (const dependency of dependenciesResult.data as {
    menu_item_id: string;
    equipment_id: string;
  }[]) {
    links.set(dependency.menu_item_id, [
      ...(links.get(dependency.menu_item_id) ?? []),
      dependency.equipment_id,
    ]);
  }

  return (
    itemsResult.data as {
      id: string;
      name: string;
      approved_alternative: string | null;
      updated_at: string;
    }[]
  )
    .map((item) => {
      const linked = (links.get(item.id) ?? []).map((equipmentId) => {
        const machine = equipment.get(equipmentId);
        return {
          id: equipmentId,
          name: machine?.name ?? "Removed machine",
          // An archived machine has no verified condition any more.
          condition: machine && !machine.archived_at ? machine.condition : null,
        };
      });

      return {
        id: item.id,
        name: item.name,
        alternative: item.approved_alternative,
        updatedAt: item.updated_at,
        status: getMenuItemStatus(linked.map((machine) => machine.condition)),
        equipment: linked.sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
