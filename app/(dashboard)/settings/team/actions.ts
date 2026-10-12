"use server";

import { revalidatePath } from "next/cache";

import { getAppUrl } from "@/lib/auth/app-url";
import { isUuid } from "@/lib/modules/equipment/validation";
import {
  isEmail,
  isInvitationToken,
  mapTeamError,
} from "@/lib/modules/team/errors";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export type InviteState = {
  error?: string;
  invite?: { email: string; url: string; expiresAt: string };
};

export type TeamActionState = {
  error?: string;
};

export async function inviteStaff(
  _state: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const membership = await requireOwner();
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";

  if (!isEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_organization_id: membership.organizationId,
    p_email: email,
  });

  if (error) {
    return {
      error: mapTeamError(
        "create_invitation",
        error,
        "We could not create the invitation.",
      ),
    };
  }

  const result = data as { token?: unknown; expires_at?: unknown } | null;
  const token = typeof result?.token === "string" ? result.token : "";
  const expiresAt =
    typeof result?.expires_at === "string" ? result.expires_at : "";

  if (!isInvitationToken(token) || !expiresAt) {
    return { error: "The invitation was created but its link was not returned." };
  }

  revalidatePath("/settings/team");
  return {
    invite: {
      email,
      url: new URL(`/invitation/${token}`, getAppUrl()).toString(),
      expiresAt,
    },
  };
}

export async function revokeInvitation(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const membership = await requireOwner();
  const invitationId = formData.get("invitationId")?.toString() ?? "";

  if (!isUuid(invitationId)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", {
    p_organization_id: membership.organizationId,
    p_invitation_id: invitationId,
  });

  if (error) {
    return {
      error: mapTeamError(
        "revoke_invitation",
        error,
        "We could not cancel the invitation.",
      ),
    };
  }

  revalidatePath("/settings/team");
  return {};
}

export async function removeMember(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const membership = await requireOwner();
  const membershipId = formData.get("membershipId")?.toString() ?? "";

  if (!isUuid(membershipId)) {
    return { error: "The request is invalid. Refresh and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_organization_id: membership.organizationId,
    p_membership_id: membershipId,
  });

  if (error) {
    return {
      error: mapTeamError(
        "remove_member",
        error,
        "We could not remove this team member.",
      ),
    };
  }

  revalidatePath("/settings/team");
  return {};
}
