import { cache } from "react";

import { getCurrentMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

// Copy from the launch plan's first-use section. Each page shows at most one.
export const TIPS = {
  equipment: "Add the machines your team uses every day.",
  qr_label: "Place this beside the machine so anyone can report a problem quickly.",
  menu_links: "Link the machines needed to prepare this item.",
  repair_closure: "Confirm the machine was checked before marking this resolved.",
} as const;

export type TipKey = keyof typeof TIPS;

export type UserPreferences = {
  dismissedTips: ReadonlySet<string>;
  staffIntroSeen: boolean;
};

// Cached per request: several components on one page read the same row.
export const getUserPreferences = cache(async (): Promise<UserPreferences> => {
  const membership = await getCurrentMembership();

  if (!membership) {
    return { dismissedTips: new Set(), staffIntroSeen: true };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("dismissed_tips, staff_reporting_intro_seen_at")
    .eq("organization_id", membership.organizationId)
    .eq("user_id", membership.userId)
    .maybeSingle();

  return {
    dismissedTips: new Set((data?.dismissed_tips as string[] | undefined) ?? []),
    staffIntroSeen: Boolean(data?.staff_reporting_intro_seen_at),
  };
});
