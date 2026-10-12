"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import type { TicketStatus } from "@/lib/modules/tickets/constants";

import {
  addRepairUpdate,
  changeTicketStatus,
  confirmFixed,
  reopenTicket,
  type TicketActionState,
} from "./actions";

const initialState: TicketActionState = {};

type StepState = "done" | "current" | "upcoming";

type StepInfo = {
  title: string;
  state: StepState;
  // Shown under the title once the step is done.
  doneNote: string;
  // Shown while the step is current or still to come.
  description: string;
  action?: React.ReactNode;
};

function StepMarker({ index, state }: Readonly<{ index: number; state: StepState }>) {
  if (state === "done") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-4"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
        state === "current"
          ? "bg-primary text-white ring-4 ring-primary-soft"
          : "border border-border-strong bg-surface text-muted"
      }`}
    >
      {index + 1}
    </span>
  );
}

function StatusButton({
  ticketId,
  version,
  status,
  label,
  variant = "primary",
}: Readonly<{
  ticketId: string;
  version: number;
  status: TicketStatus;
  label: string;
  variant?: "primary" | "secondary";
}>) {
  const [state, action, pending] = useActionState(changeTicketStatus, initialState);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
    </form>
  );
}

function ConfirmFixedForm({
  ticketId,
  version,
  equipmentName,
  machineAlreadyOperational,
  currency,
  costSoFar,
}: Readonly<{
  ticketId: string;
  version: number;
  equipmentName: string;
  machineAlreadyOperational: boolean;
  currency: string;
  costSoFar: string | null;
}>) {
  // One ID per form instance so a double click records the cost once.
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(confirmFixed, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="requestId" value={requestId} />

      <Field
        label={costSoFar ? `Additional repair cost in ${currency}` : `Repair cost in ${currency}`}
        hint={
          costSoFar
            ? `${costSoFar} is already recorded. Enter any extra cost, or 0 if none.`
            : "Required. Enter 0 if the repair was free."
        }
      >
        <input
          name="cost"
          required
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          className={inputClasses}
        />
      </Field>

      <Field label="What was fixed (optional)">
        <input
          name="workNote"
          maxLength={4000}
          autoComplete="off"
          placeholder="Replaced the heating element"
          className={inputClasses}
        />
      </Field>

      {machineAlreadyOperational ? null : (
        <p className="text-sm leading-6 text-muted">
          Confirming sets <span className="font-semibold text-foreground">{equipmentName}</span>{" "}
          back to Operational and updates the menu, unless it has another open
          ticket.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Closing…" : "Confirm it is fixed"}
      </Button>
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
    </form>
  );
}

// The whole repair as four numbered steps, so anyone can see where the
// ticket is and what to do next. Only the current step has buttons.
export function RepairSteps({
  ticketId,
  version,
  status,
  isOwner,
  reportedOn,
  fixedOn,
  workCount,
  equipmentName,
  machineAlreadyOperational,
  currency,
  costSoFar,
}: Readonly<{
  ticketId: string;
  version: number;
  status: TicketStatus;
  isOwner: boolean;
  reportedOn: string;
  fixedOn: string | null;
  workCount: number;
  equipmentName: string;
  machineAlreadyOperational: boolean;
  currency: string;
  costSoFar: string | null;
}>) {
  // open and in_progress are both the "Repair" step.
  const currentStep =
    status === "resolved" ? 4 : status === "awaiting_verification" ? 2 : 1;
  const stateOf = (stepIndex: number): StepState =>
    stepIndex < currentStep ? "done" : stepIndex === currentStep ? "current" : "upcoming";

  const steps: StepInfo[] = [
    {
      title: "Problem reported",
      state: "done",
      doneNote: `Reported ${reportedOn}.`,
      description: "",
    },
    {
      title: "Repair",
      state: stateOf(1),
      doneNote:
        workCount > 0
          ? `Repair finished. ${workCount} ${workCount === 1 ? "work entry" : "work entries"} recorded.`
          : "Repair finished.",
      description:
        status === "open"
          ? "Start the repair so the team knows someone is on it. Call your technician if needed."
          : workCount === 0
            ? "Write what was done in the work log, then mark the repair finished."
            : "When the machine has been repaired, mark the repair finished.",
      action:
        status === "open" ? (
          <StatusButton ticketId={ticketId} version={version} status="in_progress" label="Start repair" />
        ) : status === "in_progress" ? (
          <StatusButton
            ticketId={ticketId}
            version={version}
            status="awaiting_verification"
            label="Repair finished"
          />
        ) : undefined,
    },
    {
      title: "Owner checks the machine",
      state: stateOf(2),
      doneNote: "Checked and confirmed by the owner.",
      description: isOwner
        ? "Try the machine yourself. If it works, enter the repair cost and confirm the fix. If not, send it back for more work."
        : "The owner tries the machine and confirms the fix.",
      action:
        status === "awaiting_verification" ? (
          isOwner ? (
            <div className="flex flex-col gap-3">
              <ConfirmFixedForm
                ticketId={ticketId}
                version={version}
                equipmentName={equipmentName}
                machineAlreadyOperational={machineAlreadyOperational}
                currency={currency}
                costSoFar={costSoFar}
              />
              <StatusButton
                ticketId={ticketId}
                version={version}
                status="in_progress"
                label="Needs more work"
                variant="secondary"
              />
            </div>
          ) : (
            <p className="text-sm font-medium text-attention">Waiting for the owner to check.</p>
          )
        ) : undefined,
    },
    {
      title: "Fixed",
      state: status === "resolved" ? "done" : "upcoming",
      doneNote: fixedOn ? `Closed ${fixedOn}. Kept in the machine's repair history.` : "Closed.",
      description: "The ticket closes and stays in the machine's repair history.",
      action:
        status === "resolved" && isOwner ? (
          <ReopenForm ticketId={ticketId} version={version} />
        ) : undefined,
    },
  ];

  return (
    <ol>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const showAction = Boolean(step.action) && (step.state === "current" || last);

        return (
          <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0">
            {last ? null : (
              <span
                aria-hidden="true"
                className={`absolute top-10 bottom-1 left-[0.95rem] w-0.5 rounded-full ${
                  step.state === "done" ? "bg-success" : "bg-border"
                }`}
              />
            )}
            <StepMarker index={index} state={step.state} />
            <div className="min-w-0 flex-1 pt-1">
              <p
                aria-current={step.state === "current" ? "step" : undefined}
                className={`font-semibold ${step.state === "upcoming" ? "text-muted" : ""}`}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-sm leading-6 text-muted">
                {step.state === "done" ? step.doneNote : step.description}
              </p>
              {showAction ? <div className="mt-3">{step.action}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
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
