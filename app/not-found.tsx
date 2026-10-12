import type { Metadata } from "next";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
      <Logo />
      <div className="flex flex-1 flex-col justify-center py-10">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 leading-7 text-muted">
          This link may be out of date, or the QR code may have been replaced.
          If you scanned a label, ask a member of staff for help.
        </p>
        <Link href="/" className={`mt-8 w-fit ${buttonClasses()}`}>
          Go to RepairLog
        </Link>
      </div>
    </main>
  );
}
