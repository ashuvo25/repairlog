"use server";

import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/modules/equipment/validation";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export type MenuActionState = {
  error?: string;
  success?: string;
};

const MESSAGES: Record<string, string> = {
  "40001": "This item changed in another tab. Refresh and try again.",
  "42501": "Only an owner can change menu items.",
  "22023": "Some of the details are not valid. Check them and try again.",
  "23505": "A menu item with this name already exists or was archived. Use a different name.",
  P0002: "This menu item no longer exists. Refresh the page.",
  RL040: "A menu item with this name already exists.",
  RL041: "One of the selected machines is no longer active. Refresh and try again.",
};

function mapError(scope: string, error: { code: string; message: string }) {
  console.error(`${scope} failed`, { code: error.code, message: error.message });

  if (MESSAGES[error.code]) {
    return MESSAGES[error.code];
  }

  if (process.env.NODE_ENV === "development" && error.code === "PGRST202") {
    return "The menu database functions are not installed yet. Run database/990_menu_impact.sql.";
  }

  return "We could not save the menu item.";
}

function revalidateMenu() {
  revalidatePath("/menu-impact");
  revalidatePath("/today");
}

export async function saveMenuItem(
  _state: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const membership = await requireOwner();
  const menuItemId = formData.get("menuItemId")?.toString() || null;
  const expectedUpdatedAt = formData.get("updatedAt")?.toString() || null;
  const name = formData.get("name")?.toString().trim() ?? "";
  const alternative = formData.get("alternative")?.toString().trim() ?? "";
  const equipmentIds = formData
    .getAll("equipmentIds")
    .map((value) => value.toString());

  if (menuItemId && !isUuid(menuItemId)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  if (name.length < 1 || name.length > 120) {
    return { error: "Menu item name must be between 1 and 120 characters." };
  }

  if (alternative.length > 1000) {
    return { error: "Keep the alternative under 1000 characters." };
  }

  if (equipmentIds.length > 50 || !equipmentIds.every(isUuid)) {
    return { error: "The selected machines are not valid. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_menu_item", {
    p_organization_id: membership.organizationId,
    p_menu_item_id: menuItemId,
    p_expected_updated_at: expectedUpdatedAt,
    p_name: name,
    p_alternative: alternative,
    p_equipment_ids: equipmentIds,
  });

  if (error) {
    return { error: mapError("save_menu_item", error) };
  }

  revalidateMenu();
  return { success: menuItemId ? "Menu item saved." : "Menu item added." };
}

export async function archiveMenuItem(
  _state: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const membership = await requireOwner();
  const menuItemId = formData.get("menuItemId")?.toString() ?? "";

  if (!isUuid(menuItemId)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_menu_item", {
    p_organization_id: membership.organizationId,
    p_menu_item_id: menuItemId,
  });

  if (error) {
    return { error: mapError("archive_menu_item", error) };
  }

  revalidateMenu();
  return {};
}
