"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ClipboardIcon,
  CupIcon,
  InboxIcon,
  SettingsIcon,
  SunIcon,
  WrenchIcon,
} from "@/components/ui/icons";

type Item = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
  ownerOnly?: boolean;
};

const ITEMS: readonly Item[] = [
  { href: "/today", label: "Today", icon: SunIcon },
  { href: "/tickets", label: "Tickets", icon: ClipboardIcon },
  { href: "/equipment", label: "Equipment", icon: WrenchIcon },
  { href: "/menu-impact", label: "Menu", icon: CupIcon },
  { href: "/reports", label: "Reports", icon: InboxIcon, ownerOnly: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon, ownerOnly: true },
];

function useItems(isOwner: boolean) {
  const pathname = usePathname();

  return ITEMS.filter((item) => isOwner || !item.ownerOnly).map((item) => ({
    ...item,
    active: pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));
}

function CountBadge({ count }: Readonly<{ count: number }>) {
  if (count < 1) {
    return null;
  }

  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SidebarNav({
  isOwner,
  pendingReports,
}: Readonly<{ isOwner: boolean; pendingReports: number }>) {
  const items = useItems(isOwner);

  return (
    <nav aria-label="Main navigation" className="space-y-0.5">
      {items.map(({ href, label, icon: ItemIcon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${
            active
              ? "bg-primary-soft text-primary"
              : "text-muted hover:bg-subtle hover:text-foreground"
          }`}
        >
          <ItemIcon className="size-[1.15rem]" />
          {label}
          {href === "/reports" ? <CountBadge count={pendingReports} /> : null}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({
  isOwner,
  pendingReports,
}: Readonly<{ isOwner: boolean; pendingReports: number }>) {
  const items = useItems(isOwner);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {items.map(({ href, label, icon: ItemIcon, active }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                active ? "text-primary" : "text-muted"
              }`}
            >
              {active ? (
                <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
              ) : null}
              <span className="relative">
                <ItemIcon className="size-5" />
                {href === "/reports" && pendingReports > 0 ? (
                  <span className="absolute -top-1 -right-1.5 size-2.5 rounded-full border-2 border-surface bg-primary" />
                ) : null}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
