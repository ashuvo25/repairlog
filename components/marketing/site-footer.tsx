import Link from "next/link";

import { Logo } from "@/components/ui/logo";

const LINKS = [
  ["/pricing", "Pricing"],
  ["/support", "Support"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo />
        <nav aria-label="Site" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="font-medium hover:text-foreground hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <p>© {new Date().getFullYear()} RepairLog</p>
      </div>
    </footer>
  );
}
