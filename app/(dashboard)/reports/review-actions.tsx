"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

import { acceptReport, dismissReport, type ReviewState } from "./actions";

const initialState: ReviewState = {};

export function ReviewActions({ reportId }: Readonly<{ reportId: string }>) {
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
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
