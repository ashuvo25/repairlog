"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

import { acceptReport, dismissReport, type ReviewState } from "./actions";

const initialState: ReviewState = {};

const CONDITION_LABELS = {
  operational: "Operational",
  unavailable: "Unavailable",
  unknown: "Unknown",
} as const;

export function ReviewActions({
  reportId,
  equipmentName,
  currentCondition,
}: Readonly<{
  reportId: string;
  equipmentName: string;
  currentCondition: keyof typeof CONDITION_LABELS;
}>) {
  const [acceptState, accept, accepting] = useActionState(
    acceptReport,
    initialState,
  );
  const [dismissState, dismiss, dismissing] = useActionState(
    dismissReport,
    initialState,
  );
  const busy = accepting || dismissing;
  const error = acceptState.error ?? dismissState.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <form action={accept} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="reportId" value={reportId} />
          <label className="block">
            <span className="text-xs font-semibold text-muted">
              {equipmentName} condition
            </span>
            <select
              name="condition"
              defaultValue="keep"
              className="mt-1 block min-h-11 rounded-lg border border-border bg-white px-3 text-sm font-medium"
            >
              <option value="keep">
                Keep as it is ({CONDITION_LABELS[currentCondition]})
              </option>
              {currentCondition === "unavailable" ? null : (
                <option value="unavailable">Unavailable: not working</option>
              )}
              {currentCondition === "operational" ? null : (
                <option value="operational">Operational: still works</option>
              )}
              {currentCondition === "unknown" ? null : (
                <option value="unknown">Unknown: needs checking</option>
              )}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Priority</span>
            <select
              name="priority"
              defaultValue="medium"
              className="mt-1 block min-h-11 rounded-lg border border-border bg-white px-3 text-sm font-medium"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <Button type="submit" disabled={busy}>
            {accepting ? "Creating ticket…" : "Accept as ticket"}
          </Button>
        </form>
        <form action={dismiss}>
          <input type="hidden" name="reportId" value={reportId} />
          <Button type="submit" variant="secondary" disabled={busy}>
            {dismissing ? "Dismissing…" : "Dismiss"}
          </Button>
        </form>
      </div>
      <p className="text-sm leading-6 text-muted">
        Accept opens a repair ticket. Choose{" "}
        <span className="font-semibold text-foreground">Unavailable</span> if the
        machine can&apos;t be used; menu items that need it then show as
        affected. A minor problem can keep the machine Operational.
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
