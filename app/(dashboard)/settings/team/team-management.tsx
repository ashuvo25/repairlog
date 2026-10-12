"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { formatDate } from "@/lib/format";

import {
  inviteStaff,
  removeMember,
  revokeInvitation,
  type InviteState,
  type TeamActionState,
} from "./actions";

const initialInviteState: InviteState = {};
const initialActionState: TeamActionState = {};

export function InviteForm({ timezone }: Readonly<{ timezone: string }>) {
  const [state, action, pending] = useActionState(
    inviteStaff,
    initialInviteState,
  );

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <Field
          label="Staff member's Google email"
          hint="They must sign in with exactly this Google account."
        >
          <input
            // Clear the field after each successful invitation.
            key={state.invite?.url ?? "empty"}
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="off"
            placeholder="alex@gmail.com"
            className={inputClasses}
          />
        </Field>
        {state.error ? (
          <FormMessage tone="error">{state.error}</FormMessage>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating invitation…" : "Create invitation link"}
        </Button>
      </form>

      {state.invite ? (
        <div
          role="status"
          className="rounded-lg border border-primary-border bg-primary-soft p-4"
        >
          <p className="text-sm font-semibold text-primary">
            Invitation ready for {state.invite.email}
          </p>
          <p className="mt-1 text-sm leading-6 text-foreground">
            Send them this link. It works once, only for that Google account,
            until {formatDate(state.invite.expiresAt, timezone)}. It will not
            be shown again.
          </p>
          <p className="mt-3 break-all rounded-md border border-primary-border bg-white px-3 py-2 font-mono text-xs">
            {state.invite.url}
          </p>
          <div className="mt-3">
            <CopyButton
              value={state.invite.url}
              label="Copy invitation link"
              variant="primary"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeInvitationButton({
  invitationId,
  email,
}: Readonly<{ invitationId: string; email: string }>) {
  const [state, action, pending] = useActionState(
    revokeInvitation,
    initialActionState,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        aria-label={`Cancel invitation for ${email}`}
      >
        {pending ? "Cancelling…" : "Cancel"}
      </Button>
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
    </form>
  );
}

export function RemoveMemberButton({
  membershipId,
  email,
}: Readonly<{ membershipId: string; email: string }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(
    removeMember,
    initialActionState,
  );

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`Remove ${email}`}
      >
        Remove
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`remove-${membershipId}`}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-foreground/40"
      >
        <h3 id={`remove-${membershipId}`} className="text-lg font-semibold">
          Remove this team member?
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          <span className="font-semibold break-all text-foreground">{email}</span>{" "}
          will lose access to your café immediately. Their past activity is
          kept. You can invite them again later.
        </p>
        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="membershipId" value={membershipId} />
          {state.error ? (
            <FormMessage tone="error">{state.error}</FormMessage>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Keep member
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Removing…" : "Remove member"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
