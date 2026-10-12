import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { displayFont } from "@/lib/fonts";

const LINKS = [
  ["/#how-it-works", "How it works"],
  ["/pricing", "Pricing"],
  ["/support", "Support"],
] as const;

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${displayFont.variable} theme-bistro flex min-h-screen flex-col`}>
      <SiteHeader links={LINKS} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
