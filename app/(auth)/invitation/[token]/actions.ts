"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { isInvitationToken, mapTeamError } from "@/lib/modules/team/errors";
import { createClient } from "@/lib/supabase/server/client";

export type AcceptInvitationState = {
  error?: string;
};

export async function acceptInvitation(
  _state: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  await requireAuthenticatedUser();
  const token = formData.get("token")?.toString() ?? "";

  if (!isInvitationToken(token)) {
    return { error: "This invitation link is not valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error) {
    return {
      error: mapTeamError(
        "accept_invitation",
        error,
        "We could not accept this invitation. Please try again.",
      ),
    };
  }

  revalidatePath("/", "layout");
  redirect("/today");
}
