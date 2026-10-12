"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import type { TicketStatus } from "@/lib/modules/tickets/constants";

import {
  addRepairUpdate,
  changeTicketStatus,
  reopenTicket,
  type TicketActionState,
} from "./actions";

const initialState: TicketActionState = {};

type Step = { status: TicketStatus; label: string; variant: "primary" | "secondary" };

// What each status can move to. Resolving is the owner's verification step.
function nextSteps(status: TicketStatus, isOwner: boolean): Step[] {
  switch (status) {
    case "open":
      return [{ status: "in_progress", label: "Start repair", variant: "primary" }];
    case "in_progress":
      return [
        {
          status: "awaiting_verification",
          label: "Mark ready to verify",
          variant: "primary",
        },
        { status: "open", label: "Move back to open", variant: "secondary" },
      ];
    case "awaiting_verification":
      return [
        ...(isOwner
          ? [
              {
                status: "resolved",
                label: "Verify and resolve",
                variant: "primary",
              } as const,
            ]
          : []),
        {
          status: "in_progress",
          label: "Needs more work",
          variant: "secondary",
        },
      ];
    case "resolved":
      return [];
  }
}

export function StatusActions({
  ticketId,
  version,
  status,
  isOwner,
}: Readonly<{
  ticketId: string;
  version: number;
  status: TicketStatus;
  isOwner: boolean;
}>) {
  const [state, action, pending] = useActionState(
    changeTicketStatus,
    initialState,
  );
  const steps = nextSteps(status, isOwner);

  if (status === "resolved") {
    return isOwner ? <ReopenForm ticketId={ticketId} version={version} /> : null;
  }

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <input type="hidden" name="version" value={version} />
        {steps.map((step) => (
          <Button
            key={step.status}
            type="submit"
            name="status"
            value={step.status}
            variant={step.variant}
            disabled={pending}
          >
            {step.label}
          </Button>
        ))}
      </form>
      {status === "awaiting_verification" && !isOwner ? (
        <p className="text-sm leading-6 text-muted">
          An owner confirms the repair before this ticket is resolved.
        </p>
      ) : null}
      {status === "awaiting_verification" && isOwner ? (
        <p className="text-sm leading-6 text-muted">
          Confirm the machine was checked before resolving. Resolving does not
          change the machine&apos;s condition; update that on its equipment
          page.
        </p>
      ) : null}
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
    </div>
  );
}

function ReopenForm({
  ticketId,
  version,
}: Readonly<{ ticketId: string; version: number }>) {
  const [state, action, pending] = useActionState(reopenTicket, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Reopen ticket
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="version" value={version} />
      <Field label="Why is this being reopened?">
        <textarea
          name="reason"
          required
          rows={2}
          maxLength={1000}
          className={`${inputClasses} resize-y py-3 leading-6`}
        />
      </Field>
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Reopening…" : "Reopen ticket"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RepairUpdateForm({
  ticketId,
  today,
  currency,
}: Readonly<{ ticketId: string; today: string; currency: string }>) {
  // One ID per form instance; the page remounts the form after each save.
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(addRepairUpdate, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="requestId" value={requestId} />

      <Field label="Work done">
        <textarea
          name="workNote"
          required
          rows={3}
          maxLength={4000}
          placeholder="Replaced the group head gasket and tested for leaks."
          className={`${inputClasses} resize-y py-3 leading-6`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Technician (optional)">
          <input
            name="technicianName"
            maxLength={120}
            autoComplete="off"
            placeholder="Name or company"
            className={inputClasses}
          />
        </Field>
        <Field label="Date">
          <input
            name="workDate"
            type="date"
            required
            defaultValue={today}
            max={today}
            className={inputClasses}
          />
        </Field>
        <Field label={`Cost in ${currency} (optional)`}>
          <input
            name="cost"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            className={inputClasses}
          />
        </Field>
      </div>

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record repair work"}
      </Button>
    </form>
  );
}
