import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { cardClasses } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isInvitationToken } from "@/lib/modules/team/errors";
import { createClient } from "@/lib/supabase/server/client";

import { AcceptInvitationForm } from "./accept-form";

export const metadata: Metadata = {
  title: "Join your café team",
  robots: { index: false, follow: false },
  // The URL carries the invitation token; never send it to other sites.
  referrer: "no-referrer",
};

type InvitationPreview = {
  status: "valid" | "accepted" | "revoked" | "expired" | "invalid";
  cafe_name?: string;
  email_matches?: boolean;
};

const CLOSED_MESSAGES: Record<
  Exclude<InvitationPreview["status"], "valid">,
  { title: string; body: string }
> = {
  accepted: {
    title: "This invitation was already used",
    body: "If you accepted it, you are already on the team. Otherwise ask the café owner for a new link.",
  },
  revoked: {
    title: "This invitation was cancelled",
    body: "Ask the café owner to send you a new invitation link.",
  },
  expired: {
    title: "This invitation has expired",
    body: "Invitation links last seven days. Ask the café owner for a new one.",
  },
  invalid: {
    title: "This invitation link is not valid",
    body: "Check that you opened the complete link, or ask the café owner for a new one.",
  },
};

function SignOutForm({ label }: Readonly<{ label: string }>) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={buttonClasses({ variant: "secondary", fullWidth: true })}
      >
        {label}
      </button>
    </form>
  );
}

export default async function InvitationPage({
  params,
}: PageProps<"/invitation/[token]">) {
  const { token } = await params;

  if (!isInvitationToken(token)) {
    notFound();
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/invitation/${token}`)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitation_preview", {
    p_token: token,
  });

  if (error) {
    throw new Error("Unable to open this invitation.");
  }

  const preview = data as InvitationPreview;
  const cafeName = preview.cafe_name ?? "your café";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
      <Logo />
      <div className="flex flex-1 flex-col justify-center py-10">
        {preview.status !== "valid" ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              {CLOSED_MESSAGES[preview.status].title}
            </h1>
            <p className="mt-3 leading-7 text-muted">
              {CLOSED_MESSAGES[preview.status].body}
            </p>
            <Link href="/today" className={`mt-8 w-fit ${buttonClasses()}`}>
              Go to RepairLog
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-muted">Team invitation</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">
              Join {cafeName} on RepairLog
            </h1>
            <p className="mt-3 leading-7 text-muted">
              You have been invited as a staff member. You will be able to see
              the café&apos;s equipment and its condition.
            </p>

            <section className={`${cardClasses} mt-6 space-y-4 p-5`}>
              <div>
                <p className="text-sm font-medium text-muted">Signed in as</p>
                <p className="mt-0.5 font-semibold break-all">
                  {user.email ?? "Unknown account"}
                </p>
              </div>

              {preview.email_matches ? (
                <AcceptInvitationForm token={token} cafeName={cafeName} />
              ) : (
                <>
                  <p className="rounded-lg border border-attention-border bg-attention-soft px-4 py-3 text-sm leading-6 text-attention">
                    This invitation was sent to a different Google account.
                    Sign out, then open the link again and sign in with the
                    invited account.
                  </p>
                  <SignOutForm label="Sign out" />
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
