import { NavLinks } from "@/components/layout/main-nav";
import { PageHeader } from "@/components/layout/page-header";
import { requireOwner } from "@/lib/permissions/current-membership";

const SETTINGS_TABS = [
  { href: "/settings/organization", label: "Café details" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/export", label: "Export" },
] as const;

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireOwner();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Settings"
        description="Manage your café details, your team and your subscription."
      />
      <div className="mt-6 border-b border-border pb-3">
        <NavLinks items={SETTINGS_TABS} label="Settings sections" />
      </div>
      <div className="mt-8">{children}</div>
    </main>
  );
}
