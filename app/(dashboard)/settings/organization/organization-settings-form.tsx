"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { TimezoneSelect } from "@/components/ui/timezone-select";

import {
  updateOrganization,
  type OrganizationSettingsState,
} from "./actions";

const initialState: OrganizationSettingsState = {};

export function OrganizationSettingsForm({
  name,
  locationName,
  timezone,
  currency,
}: Readonly<{
  name: string;
  locationName: string;
  timezone: string;
  currency: string;
}>) {
  const [state, action, pending] = useActionState(
    updateOrganization,
    initialState,
  );

  return (
    <form action={action} className="space-y-6">
      <Field label="Café name" hint="Shown to your team and on QR report pages.">
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={name}
          autoComplete="organization"
          className={inputClasses}
        />
      </Field>

      <Field label="Location name">
        <input
          name="locationName"
          required
          maxLength={120}
          defaultValue={locationName}
          autoComplete="off"
          className={inputClasses}
        />
      </Field>

      <Field
        label="Time zone"
        hint="Sets local dates and where each day's expenses begin and end."
      >
        <TimezoneSelect defaultValue={timezone} />
      </Field>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-subtle px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Currency</p>
          <p className="text-sm leading-6 text-muted">
            Fixed when the café was created, so past costs stay consistent.
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-white px-2.5 py-1 text-sm font-semibold">
          {currency}
        </span>
      </div>

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
