import { cache } from "react";

import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server/client";

export type MembershipRole = "owner" | "staff";

export type CurrentMembership = {
  organizationId: string;
  role: MembershipRole;
  userId: string;
};

// Cached per request: the layout and the page both need the membership.
export const getCurrentMembership = cache(async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("organization_id, role, user_id")
    .eq("user_id", user.id)
    .eq("state", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to verify your café membership.");
  }

  if (!data) {
    return null;
  }

  return {
    organizationId: data.organization_id,
    role: data.role as MembershipRole,
    userId: data.user_id,
  };
});

export async function requireMembership() {
  const membership = await getCurrentMembership();

  if (!membership) {
    redirect("/onboarding");
  }

  return membership;
}

export async function requireOwner() {
  const membership = await requireMembership();

  if (membership.role !== "owner") {
    redirect("/today");
  }

  return membership;
}
