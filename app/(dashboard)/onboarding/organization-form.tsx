"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { ArrowRightIcon } from "@/components/ui/icons";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import {
  DEFAULT_TIMEZONE,
  isUsTimezone,
} from "@/lib/modules/organizations/timezones";

import {
  createOrganization,
  type CreateOrganizationState,
} from "./actions";

const initialState: CreateOrganizationState = {};

const subscribeToNothing = () => () => {};

// The device timezone is only known in the browser, so the server renders
// the default and the browser swaps in the detected zone after hydration.
function useDeviceTimezone() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

export function OrganizationForm() {
  const [requestId] = useState(() => crypto.randomUUID());
  const [chosenTimezone, setChosenTimezone] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    createOrganization,
    initialState,
  );

  const deviceTimezone = useDeviceTimezone();
  const detectedTimezone = isUsTimezone(deviceTimezone) ? deviceTimezone : null;
  const timezone = chosenTimezone ?? detectedTimezone ?? DEFAULT_TIMEZONE;
  const timezoneHint =
    timezone === detectedTimezone
      ? "Detected from this device. Change it if the café is somewhere else."
      : "Choose the timezone where the café physically is.";

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="currency" value="USD" />

      <Field label="Café name" hint="Shown to your team and on QR report pages.">
        <input
          name="name"
          required
          maxLength={120}
          autoComplete="organization"
          placeholder="Blue Door Coffee"
          className={inputClasses}
        />
      </Field>

      <Field
        label="Location name"
        hint="A short name for this site, such as Downtown or Main Street."
      >
        <input
          name="locationName"
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Downtown"
          className={inputClasses}
        />
      </Field>

      <Field label="Time zone" hint={timezoneHint}>
        <TimezoneSelect value={timezone} onChange={setChosenTimezone} />
      </Field>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-subtle px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Currency</p>
          <p className="text-sm leading-6 text-muted">
            Repair costs are recorded in US dollars.
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-white px-2.5 py-1 text-sm font-semibold tabular-nums">
          USD $
        </span>
      </div>

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? "Creating your café…" : "Create café workspace"}
        {pending ? null : <ArrowRightIcon />}
      </Button>
    </form>
  );
}
