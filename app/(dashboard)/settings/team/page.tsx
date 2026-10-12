import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { formatDate } from "@/lib/format";
import { requireOwner } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import {
  InviteForm,
  RemoveMemberButton,
  RevokeInvitationButton,
} from "./team-management";

export const metadata: Metadata = {
  title: "Team",
};

type TeamMember = {
  membership_id: string;
  email: string;
  role: "owner" | "staff";
  joined_at: string;
  is_self: boolean;
};

type PendingInvitation = {
  id: string;
  intended_email: string;
  expires_at: string;
};

export default async function TeamSettingsPage() {
  const membership = await requireOwner();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [organizationResult, membersResult, invitationsResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("timezone")
        .eq("id", membership.organizationId)
        .single(),
      supabase.rpc("list_team_members", {
        p_organization_id: membership.organizationId,
      }),
      supabase
        .from("invitations")
        .select("id, intended_email, expires_at")
        .eq("organization_id", membership.organizationId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", now)
        .order("created_at", { ascending: false }),
    ]);

  // The team functions arrive with database/950_team_module.sql.
  if (membersResult.error?.code === "PGRST202") {
    return (
      <FormMessage tone="error">
        Team management is not available yet. The database update
        950_team_module.sql has not been applied.
      </FormMessage>
    );
  }

  if (membersResult.error || invitationsResult.error) {
    throw new Error("Unable to load the team.");
  }

  const timezone: string = organizationResult.data?.timezone ?? "UTC";
  const members = (membersResult.data ?? []) as TeamMember[];
  const invitations = (invitationsResult.data ?? []) as PendingInvitation[];

  return (
    <div className="space-y-6">
      <Card
        title="Invite a staff member"
        description="Staff can view equipment and its condition. They cannot see costs or change settings."
      >
        <InviteForm timezone={timezone} />
      </Card>

      <Card
        title="Team members"
        description="Everyone who can sign in to your café workspace."
      >
        <ul className="divide-y divide-border">
          {members.map((member) => (
            <li
              key={member.membership_id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {member.email}
                  {member.is_self ? (
                    <span className="font-normal text-muted"> (you)</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted">
                  Joined {formatDate(member.joined_at, timezone)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={member.role === "owner" ? "positive" : "neutral"}>
                  {member.role === "owner" ? "Owner" : "Staff"}
                </Badge>
                {member.role === "staff" && !member.is_self ? (
                  <RemoveMemberButton
                    membershipId={member.membership_id}
                    email={member.email}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Pending invitations"
        description="Links that have been created but not used yet."
      >
        {invitations.length ? (
          <ul className="divide-y divide-border">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {invitation.intended_email}
                  </p>
                  <p className="text-sm text-muted">
                    Expires {formatDate(invitation.expires_at, timezone)}
                  </p>
                </div>
                <RevokeInvitationButton
                  invitationId={invitation.id}
                  email={invitation.intended_email}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-subtle px-4 py-6 text-center text-sm leading-6 text-muted">
            No pending invitations. To replace a lost link, invite the same
            email again.
          </p>
        )}
      </Card>
    </div>
  );
}
