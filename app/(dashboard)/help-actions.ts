"use server";

import { revalidatePath } from "next/cache";

import { TIPS } from "@/lib/modules/onboarding/tips";
import { requireMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export async function dismissTip(formData: FormData) {
  const membership = await requireMembership();
  const tipKey = formData.get("tipKey")?.toString() ?? "";

  if (!(tipKey in TIPS)) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_tip", {
    p_organization_id: membership.organizationId,
    p_tip_key: tipKey,
  });

  if (error) {
    console.error("dismiss_tip failed", { code: error.code });
  }

  revalidatePath("/", "layout");
}

export async function resetTips() {
  const membership = await requireMembership();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_tips", {
    p_organization_id: membership.organizationId,
  });

  if (error) {
    console.error("reset_tips failed", { code: error.code });
  }

  revalidatePath("/", "layout");
}

export async function markStaffIntroSeen() {
  const membership = await requireMembership();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_staff_intro_seen", {
    p_organization_id: membership.organizationId,
  });

  if (error) {
    console.error("mark_staff_intro_seen failed", { code: error.code });
  }

  revalidatePath("/today");
}
