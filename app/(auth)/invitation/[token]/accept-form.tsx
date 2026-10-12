"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

import { acceptInvitation, type AcceptInvitationState } from "./actions";

const initialState: AcceptInvitationState = {};

export function AcceptInvitationForm({
  token,
  cafeName,
}: Readonly<{ token: string; cafeName: string }>) {
  const [state, action, pending] = useActionState(
    acceptInvitation,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? "Joining…" : `Join ${cafeName}`}
      </Button>
    </form>
  );
}
