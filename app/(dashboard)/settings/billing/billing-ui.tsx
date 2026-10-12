"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

import {
  openBillingPortal,
  refreshSubscription,
  startCheckout,
  turnOffAutoRenew,
  turnOnAutoRenew,
  type BillingActionState,
} from "./actions";

const initialState: BillingActionState = {};

function Messages({ state }: Readonly<{ state: BillingActionState }>) {
  return (
    <>
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}
    </>
  );
}

export function SubscribeButton({
  plan,
  label,
  variant = "primary",
}: Readonly<{
  plan: "monthly" | "yearly";
  label: string;
  variant?: "primary" | "secondary";
}>) {
  const [state, action, pending] = useActionState(startCheckout, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan" value={plan} />
      <Button type="submit" variant={variant} fullWidth disabled={pending}>
        {pending ? "Opening secure checkout…" : label}
      </Button>
      <Messages state={state} />
    </form>
  );
}

export function ManageBillingButton() {
  const [state, action, pending] = useActionState(
    openBillingPortal,
    initialState,
  );

  return (
    <form action={action} className="space-y-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Opening billing portal…" : "Manage billing"}
      </Button>
      <Messages state={state} />
    </form>
  );
}

export function RefreshStatusButton() {
  const [state, action, pending] = useActionState(
    refreshSubscription,
    initialState,
  );

  return (
    <form action={action} className="space-y-3">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Checking…" : "Refresh status"}
      </Button>
      <Messages state={state} />
    </form>
  );
}

const POLL_INTERVAL_MS = 5_000;
const POLL_LIMIT = 24;

// Shown after returning from checkout. The redirect itself proves nothing;
// the page re-reads the database until the verified webhook has arrived.
export function CheckoutPending() {
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  const waiting = checks < POLL_LIMIT;

  useEffect(() => {
    if (!waiting) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.refresh();
      setChecks((count) => count + 1);
    }, POLL_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [checks, waiting, router]);

  return (
    <div
      role="status"
      className="rounded-lg border border-attention-border bg-attention-soft px-4 py-3 text-sm leading-6 text-attention"
    >
      <p className="font-semibold">
        {waiting ? "Checking your subscription…" : "Still waiting for confirmation"}
      </p>
      <p>
        {waiting
          ? "Thanks. We are confirming the payment with the provider. This usually takes under a minute."
          : "The payment provider has not confirmed the payment yet. If you were charged, it will appear here shortly; reload this page in a few minutes."}
      </p>
    </div>
  );
}

// Stopping auto-renew asks for confirmation; turning it back on does not.
export function AutoRenewControl({
  autoRenewOn,
  accessUntil,
}: Readonly<{ autoRenewOn: boolean; accessUntil: string | null }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [offState, turnOff, turningOff] = useActionState(turnOffAutoRenew, initialState);
  const [onState, turnOn, turningOn] = useActionState(turnOnAutoRenew, initialState);

  if (!autoRenewOn) {
    return (
      <form action={turnOn} className="space-y-3">
        <Button type="submit" disabled={turningOn}>
          {turningOn ? "Turning on…" : "Turn auto-renew back on"}
        </Button>
        <Messages state={onState} />
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <Button variant="secondary" onClick={() => dialogRef.current?.showModal()}>
        Turn off auto-renew
      </Button>
      <Messages state={offState} />

      <dialog
        ref={dialogRef}
        aria-labelledby="auto-renew-title"
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-foreground/40"
      >
        <h3 id="auto-renew-title" className="font-display text-xl font-semibold">
          Turn off auto-renew?
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          You won&apos;t be charged again.
          {accessUntil
            ? ` Everything keeps working until ${accessUntil}.`
            : " Everything keeps working until the end of the period you paid for."}{" "}
          After that, customers can&apos;t report faults by QR code until you
          choose a plan again. You can turn auto-renew back on any time before
          then.
        </p>
        <form
          action={() => {
            dialogRef.current?.close();
            turnOff();
          }}
          className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        >
          <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
            Keep auto-renew
          </Button>
          <Button type="submit" variant="danger" disabled={turningOff}>
            {turningOff ? "Turning off…" : "Turn off auto-renew"}
          </Button>
        </form>
      </dialog>
    </div>
  );
}
