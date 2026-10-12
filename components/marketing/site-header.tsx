import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export function SiteHeader({
  links = [],
}: Readonly<{ links?: readonly (readonly [string, string])[] }>) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Logo />
        {links.length ? (
          <nav
            aria-label="Page sections"
            className="hidden items-center gap-1 text-sm font-semibold text-muted md:flex"
          >
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 items-center rounded-lg px-3 hover:bg-subtle hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : null}
        <Link href="/sign-in" className={buttonClasses()}>
          Sign in
        </Link>
      </div>
    </header>
  );
}
