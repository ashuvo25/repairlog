import Link from "next/link";

import { BottomNav, SidebarNav } from "@/components/layout/app-nav";
import { LogOutIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { displayFont } from "@/lib/fonts";
import { getCurrentMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

import { resetTips } from "./help-actions";

export const dynamic = "force-dynamic";

function SignOutButton({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        aria-label={compact ? "Sign out" : undefined}
        className={
          compact
            ? "flex size-11 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
            : "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-muted hover:bg-subtle hover:text-foreground"
        }
      >
        <LogOutIcon className="size-[1.15rem]" />
        {compact ? null : "Sign out"}
      </button>
    </form>
  );
}

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAuthenticatedUser();
  const membership = await getCurrentMembership();
  const isOwner = membership?.role === "owner";

  let cafeName = "Your café";
  let pendingReports = 0;

  if (membership) {
    const supabase = await createClient();
    const [organizationResult, reportsResult] = await Promise.all([
      supabase
        .from("organizations")
        .select("name")
        .eq("id", membership.organizationId)
        .single(),
      isOwner
        ? supabase
            .from("public_reports")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", membership.organizationId)
            .eq("status", "pending")
        : Promise.resolve({ count: 0 }),
    ]);
    cafeName = organizationResult.data?.name ?? cafeName;
    pendingReports = reportsResult.count ?? 0;
  }

  const shellClasses = `${displayFont.variable} theme-bistro min-h-screen`;

  // Café setup (no membership yet): a plain header, no navigation.
  if (!membership) {
    return (
      <div className={`${shellClasses} flex flex-col`}>
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
            <Logo href="/onboarding" />
            <SignOutButton compact />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className={`${shellClasses} lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]`}>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface px-3 py-5 lg:flex print:hidden">
        <div className="px-3">
          <Logo href="/today" />
        </div>

        <div className="mx-3 mt-6 rounded-md border border-border bg-background px-3 py-2.5">
          <p className="font-display truncate text-base font-semibold">{cafeName}</p>
          <p className="text-xs text-muted capitalize">{membership.role}</p>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto">
          <SidebarNav isOwner={isOwner} pendingReports={pendingReports} />
        </div>

        <div className="space-y-0.5 border-t border-border pt-3">
          <form action={resetTips}>
            <button
              type="submit"
              className="flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm text-muted hover:bg-subtle hover:text-foreground"
            >
              Show setup tips again
            </button>
          </form>
          <Link
            href="/support"
            className="flex min-h-10 items-center rounded-md px-3 text-sm text-muted hover:bg-subtle hover:text-foreground"
          >
            Help &amp; support
          </Link>
          <p className="truncate px-3 pt-2 text-xs text-muted" title={user.email ?? undefined}>
            {user.email ?? "Signed in"}
          </p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur lg:hidden print:hidden">
          <Logo href="/today" />
          <div className="flex min-w-0 items-center gap-1">
            <span className="font-display truncate text-sm font-semibold">{cafeName}</span>
            <SignOutButton compact />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>

      <BottomNav isOwner={isOwner} pendingReports={pendingReports} />
    </div>
  );
}
