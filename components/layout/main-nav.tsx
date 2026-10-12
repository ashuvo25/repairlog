"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = Readonly<{ href: string; label: string }>;

const MEMBER_ITEMS: readonly NavItem[] = [
  { href: "/today", label: "Today" },
  { href: "/tickets", label: "Tickets" },
  { href: "/equipment", label: "Equipment" },
  { href: "/menu-impact", label: "Menu" },
];

const OWNER_ITEMS: readonly NavItem[] = [
  ...MEMBER_ITEMS,
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks({
  items,
  label,
}: Readonly<{ items: readonly NavItem[]; label: string }>) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
              active
                ? "bg-primary-soft text-primary"
                : "text-muted hover:bg-subtle hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MainNav({ isOwner }: Readonly<{ isOwner: boolean }>) {
  return (
    <NavLinks
      items={isOwner ? OWNER_ITEMS : MEMBER_ITEMS}
      label="Main navigation"
    />
  );
}
