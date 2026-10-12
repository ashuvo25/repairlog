import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormMessage } from "@/components/ui/form-message";
import { GoogleIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { getSafeNextPath } from "@/lib/auth/app-url";
import { displayFont } from "@/lib/fonts";
import { createClient } from "@/lib/supabase/server/client";

import { signInWithGoogle } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your café's RepairLog workspace.",
};

type SignInPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next ?? null);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect(nextPath);
  }

  return (
    <main
      className={`${displayFont.variable} theme-bistro grid min-h-screen lg:grid-cols-2`}
    >
      <section className="flex flex-col px-5 py-8 sm:px-12 lg:px-16">
        <Logo />

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-14">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome back.
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted">
            Sign in with the Google account your café invited.
          </p>

          {params.error ? (
            <div className="mt-6">
              <FormMessage tone="error">
                We could not complete Google sign-in. Please try again.
              </FormMessage>
            </div>
          ) : null}

          <form action={signInWithGoogle} className="mt-8">
            <input type="hidden" name="next" value={nextPath} />
            <button
              type="submit"
              className="flex min-h-14 w-full items-center justify-center gap-3 rounded-md border border-border-strong bg-white px-5 font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-surface"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <div className="mt-10 space-y-4 border-t border-border pt-6 text-sm leading-6 text-muted">
            <p>
              <span className="font-semibold text-foreground">Joining a team?</span>{" "}
              Open the invitation link your café owner sent, then sign in with
              that same Google account.
            </p>
            <p>
              <span className="font-semibold text-foreground">New to RepairLog?</span>{" "}
              <Link href="/" className="font-semibold text-primary underline underline-offset-4">
                See how it works
              </Link>{" "}
              before you set up your café.
            </p>
          </div>
        </div>

        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline">
            Terms
          </Link>
          <Link href="/support" className="hover:text-foreground hover:underline">
            Support
          </Link>
        </nav>
      </section>

      <aside className="relative hidden lg:block">
        <Image
          src="/images/home/cafe-bar.jpg"
          alt="An espresso machine and grinder on a wooden café counter"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1c120c]/85 to-transparent"
        />
        <p className="font-display absolute right-12 bottom-12 left-12 max-w-md text-3xl leading-tight font-semibold text-[#f7f0e4]">
          Every fault, every fix and every repair cost, in one place your whole
          team can see.
        </p>
      </aside>
    </main>
  );
}
