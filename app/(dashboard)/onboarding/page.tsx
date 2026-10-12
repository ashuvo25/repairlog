import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { Card, cardClasses } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = {
  title: "Create your café",
};

const SETUP_STEPS = [
  {
    title: "Create your café",
    body: "Name your workspace and set its time zone.",
  },
  {
    title: "Add your machines",
    body: "Espresso machine, grinder, fridge — anything that can break.",
  },
  {
    title: "Print QR labels",
    body: "Stick one beside each machine so faults get reported fast.",
  },
] as const;

// Before database/960_pilot_owner_access.sql is applied the check function
// does not exist, and café creation stays open as it was.
async function canCreateOrganization() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_create_organization");

  if (error) {
    if (error.code === "PGRST202") {
      return true;
    }

    throw new Error("Unable to check café setup access.");
  }

  return data === true;
}

function NotInvited({ email }: Readonly<{ email: string | null }>) {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-14 sm:px-8 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">
        You&apos;re not on a team yet
      </h1>
      <p className="mt-3 leading-7 text-muted">
        {email ? (
          <>
            <span className="font-semibold text-foreground">{email}</span> is
            not linked to a café.{" "}
          </>
        ) : null}
        If you are joining a café team, use the invitation link from the owner.
      </p>
      <ul className="mt-6 space-y-3 text-sm leading-6">
        <li className={`${cardClasses} p-4`}>
          <span className="font-semibold">Joining a café team?</span> Ask the
          owner for an invitation link and open it while signed in with this
          account.
        </li>
        <li className={`${cardClasses} p-4`}>
          <span className="font-semibold">Used a different Google account?</span>{" "}
          Sign out and sign in with the account that was invited.
        </li>
      </ul>
      <form action="/auth/signout" method="post" className="mt-8">
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          Sign out
        </button>
      </form>
    </main>
  );
}

export default async function OnboardingPage() {
  const membership = await getCurrentMembership();

  if (membership) {
    redirect("/today");
  }

  if (!(await canCreateOrganization())) {
    const user = await requireAuthenticatedUser();
    return <NotInvited email={user.email} />;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary-border bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          Step 1 of {SETUP_STEPS.length}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Create your café
        </h1>
        <p className="mt-3 text-lg leading-8 text-muted">
          Set up your workspace in about a minute. Your 15-day free trial
          starts today, with no card needed.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card
          title="Café details"
          description="The basics your team will see every day."
        >
          <OrganizationForm />
        </Card>

        <aside className={`${cardClasses} p-5 sm:p-6`}>
          <h2 className="text-sm font-semibold">Your setup</h2>
          <ol className="mt-5">
            {SETUP_STEPS.map((step, index) => {
              const current = index === 0;
              const last = index === SETUP_STEPS.length - 1;

              return (
                <li
                  key={step.title}
                  aria-current={current ? "step" : undefined}
                  className="relative flex gap-3 pb-6 last:pb-0"
                >
                  {last ? null : (
                    <span
                      aria-hidden="true"
                      className="absolute top-8 bottom-0 left-[0.8125rem] w-px bg-border"
                    />
                  )}
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                      current
                        ? "bg-primary text-white"
                        : "border border-border-strong bg-white text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5">
                    <span
                      className={`block text-sm font-semibold ${current ? "" : "text-muted"}`}
                    >
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-6 text-muted">
                      {step.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 border-t border-border pt-5 text-sm leading-6 text-muted">
            Your café&apos;s records are private to your team. A QR page
            shows only the café name and the machine name.
          </p>
        </aside>
      </div>
    </main>
  );
}
