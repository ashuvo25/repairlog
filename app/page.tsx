import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { DemoVideo } from "@/components/marketing/demo-video";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { cardClasses } from "@/components/ui/card";
import {
  ArrowRightIcon,
  CupIcon,
  DownloadIcon,
  HelpIcon,
  HistoryIcon,
  MessageIcon,
  PhoneIcon,
  PlayIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { displayFont } from "@/lib/fonts";
import { getVariantPrice } from "@/lib/providers/lemonsqueezy/client";
import {
  getLemonSqueezyConfig,
  isBillingConfigured,
} from "@/lib/providers/lemonsqueezy/config";

export const metadata: Metadata = {
  title: {
    absolute: "RepairLog — Equipment fault tracking for cafés",
  },
  description:
    "Staff and customers report broken café equipment from a QR code. Owners track every repair, see which menu items are affected, and keep a full repair history.",
  alternates: { canonical: "/" },
};

// Prices come from the payment provider; the page refreshes every 15 minutes.
export const revalidate = 900;

const ESPRESSO = "bg-[#2a1b12]";
const CHALKBOARD = "bg-[#1e2622]";

const ROLES = [
  {
    icon: CupIcon,
    role: "Café owner",
    body: "Sees every open fault, approves reports, records repairs and costs, and confirms when a machine is fixed.",
  },
  {
    icon: UsersIcon,
    role: "Floor & kitchen staff",
    body: "Reports a problem in seconds, follows the repair, and knows which drinks to stop selling.",
  },
  {
    icon: PhoneIcon,
    role: "Anyone nearby",
    body: "Customers, cleaners or contractors scan the label and describe the fault. No app, no account.",
  },
] as const;

const PROBLEMS = [
  {
    icon: MessageIcon,
    title: "The message gets lost in WhatsApp",
    body: "and nobody knows who is fixing it.",
  },
  {
    icon: HelpIcon,
    title: "Staff don't know what to stop selling",
    body: "so customers order drinks you can't make.",
  },
  {
    icon: HistoryIcon,
    title: "Nobody remembers past repairs",
    body: "what was fixed, by whom, or what it cost.",
  },
] as const;

const BOARD = [
  { item: "Flat white", available: false, note: "Grinder down — offer filter coffee" },
  { item: "Cappuccino", available: false, note: "Grinder down" },
  { item: "Cold brew", available: true, note: null },
  { item: "Iced tea", available: true, note: null },
  { item: "Toasted sandwich", available: true, note: null },
] as const;

const MENU_SECTIONS = [
  {
    heading: "Front of house",
    items: [
      [
        "QR fault reporting",
        "A printable label for every machine. Reports arrive with up to two photos, stripped of location data.",
      ],
      [
        "Owner's review inbox",
        "Public reports never change anything on their own. Accept each one into a ticket, or dismiss it.",
      ],
      [
        "Menu impact",
        "Link drinks to the machines they need, so the team knows what's off the menu.",
      ],
    ],
  },
  {
    heading: "Back office",
    items: [
      [
        "Verified repairs",
        "Open, in progress, ready to verify, resolved. Only an owner confirms a fix.",
      ],
      [
        "Repair history & costs",
        "Work notes, technician and date on every machine. Costs stay owner-only.",
      ],
      [
        "Today at a glance",
        "Open faults, affected items and today's repair spend before the doors open.",
      ],
    ],
  },
] as const;

const STEPS = [
  ["Scan", "Someone scans the QR label beside the machine."],
  ["Report", "They describe the fault in under a minute."],
  ["Review", "The owner accepts the report into a ticket."],
  ["Repair", "Work and costs are recorded as they happen."],
  ["Verify", "The owner confirms the machine works again."],
] as const;

const PRIVACY = [
  {
    icon: ShieldIcon,
    title: "Private by default",
    body: "A QR page shows only your café name and the machine name. Everything else stays with your team.",
  },
  {
    icon: UsersIcon,
    title: "Right people, right data",
    body: "Staff see equipment and tickets. Costs and billing stay with owners. Removing someone ends access instantly.",
  },
  {
    icon: DownloadIcon,
    title: "Your records are yours",
    body: "Export equipment, tickets, repair history and costs as CSV whenever you like.",
  },
] as const;

const FAQ = [
  [
    "Do customers need to download an app?",
    "No. The QR code opens a simple web page in the phone's browser. There is no app and no account to create.",
  ],
  [
    "Can a prank report mess up my records?",
    "No. Public reports land in your review inbox and change nothing until you accept them. Reports are rate-limited and bot-protected.",
  ],
  [
    "What equipment can I track?",
    "Anything that can break: espresso machines, grinders, fridges, ovens, dishwashers, furniture and fixtures.",
  ],
  [
    "Can my staff see what repairs cost?",
    "No. Costs and billing are visible to owners only. Staff see equipment, tickets and repair notes.",
  ],
  [
    "How do I cancel?",
    "From Settings → Billing → Manage billing, at any time. You keep access until the end of the period you paid for, and you can export your data first.",
  ],
] as const;

function formatPrice(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

async function loadPrices() {
  if (!isBillingConfigured()) {
    return null;
  }

  try {
    const config = getLemonSqueezyConfig();
    const [monthly, yearly] = await Promise.all([
      getVariantPrice(config.variants.monthly, config),
      getVariantPrice(config.variants.yearly, config),
    ]);
    return { monthly: monthly.priceMinor, yearly: yearly.priceMinor };
  } catch {
    return null;
  }
}

function Eyebrow({
  children,
  light = false,
}: Readonly<{ children: React.ReactNode; light?: boolean }>) {
  return (
    <p
      className={`text-xs font-semibold tracking-[0.2em] uppercase ${light ? "text-[#b9cdb9]" : "text-primary"}`}
    >
      {children}
    </p>
  );
}

function DisplayHeading({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <h2
      className={`font-display text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1] ${className}`}
    >
      {children}
    </h2>
  );
}

const PILL_PRIMARY =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#57745b] px-7 font-semibold text-white shadow-lg shadow-black/20 transition-colors hover:bg-[#4a654e]";

export default async function HomePage() {
  const prices = await loadPrices();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RepairLog",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Equipment fault reporting and repair tracking for independent cafés and restaurants.",
    ...(prices
      ? {
          offers: {
            "@type": "Offer",
            price: (prices.monthly / 100).toFixed(2),
            priceCurrency: "USD",
          },
        }
      : {}),
  };

  return (
    <div className={`${displayFont.variable} theme-bistro flex min-h-screen flex-col`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader
        links={[
          ["#menu", "What's on the menu"],
          ["#how-it-works", "How it works"],
          ["/pricing", "Pricing"],
          ["#faq", "FAQ"],
        ]}
      />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pt-10 pb-16 sm:px-8 sm:pt-14 lg:grid-cols-12 lg:items-center lg:gap-12 lg:pb-20">
          <div className="lg:col-span-6">
            <h1 className="font-display text-[2.5rem] leading-[1.06] font-semibold tracking-tight text-balance sm:text-[3.25rem]">
              When the grinder dies at 7&nbsp;a.m., your whole team should
              know by 7:01.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-pretty text-muted">
              RepairLog puts a QR label on every machine in your café. Staff, or
              anyone standing there, scan it to report a fault. You get one list
              of what&apos;s broken, what&apos;s off the menu, and what each
              repair cost.
            </p>
            <div className="mt-8 flex flex-col gap-x-6 gap-y-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/sign-in"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary whitespace-nowrap px-6 font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                Set up your café
                <ArrowRightIcon />
              </Link>
              <a
                href="#demo"
                className="inline-flex min-h-12 items-center justify-center gap-2 font-semibold whitespace-nowrap text-foreground underline decoration-border-strong decoration-2 underline-offset-[6px] hover:decoration-primary"
              >
                <PlayIcon className="size-3.5" />
                Watch the 90-second demo
              </a>
            </div>
            <p className="mt-6 text-sm leading-6 text-muted">
              No app and no hardware. Print the labels on any office printer.
            </p>
          </div>

          <figure className="relative lg:col-span-6">
            <Image
              src="/images/home/espresso-counter.jpg"
              alt="A barista reaching for the grinder behind a white espresso machine on a busy café counter"
              width={1800}
              height={1200}
              priority
              sizes="(min-width: 1024px) 580px, 100vw"
              className="aspect-[4/3] w-full rounded-lg object-cover sm:aspect-[3/2]"
            />
            {/* A real report, as the owner would receive it. */}
            <figcaption className="absolute -bottom-6 left-4 w-[min(20rem,calc(100%-2rem))] rounded-md border border-border bg-surface p-4 text-sm shadow-[0_12px_30px_-12px_rgba(42,27,18,0.35)] sm:left-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">Espresso machine</span>
                <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                  New report
                </span>
              </div>
              <p className="mt-1.5 leading-6 text-muted">
                &ldquo;Left group head is leaking onto the drip tray.&rdquo;
              </p>
              <p className="mt-2 text-xs text-muted">Scanned from the QR label · 7:01 a.m.</p>
            </figcaption>
          </figure>
        </section>

        {/* Roles */}
        <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-14 sm:px-8 md:grid-cols-3">
          {ROLES.map(({ icon: RoleIcon, role, body }) => (
            <div key={role} className="flex gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary-border bg-primary-soft text-primary">
                <RoleIcon className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">{role}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Problem */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24">
            <div>
              <Eyebrow>Sound familiar?</Eyebrow>
              <DisplayHeading className="mt-3">
                When something breaks in the middle of service…
              </DisplayHeading>
              <p className="mt-4 max-w-md text-lg leading-8 text-muted">
                A broken grinder is a small problem. Not knowing about it, or
                forgetting it by the next shift, is the expensive one.
              </p>
            </div>
            <ul className="space-y-3">
              {PROBLEMS.map(({ icon: ProblemIcon, title, body }) => (
                <li
                  key={title}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4 sm:p-5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <ProblemIcon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm leading-6 text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Chalkboard: menu impact */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow>Menu impact</Eyebrow>
              <DisplayHeading className="mt-3">
                Know what&apos;s off the menu before the rush.
              </DisplayHeading>
              <p className="mt-4 max-w-md text-lg leading-8 text-muted">
                Link each menu item to the machines it needs. When the owner
                marks a machine unavailable, the whole team sees what to stop
                selling, and what to offer instead.
              </p>
            </div>
            <div
              aria-hidden="true"
              className={`${CHALKBOARD} rounded-2xl border-[10px] border-[#6b4a32] p-6 text-[#efeae0] shadow-xl sm:p-8`}
            >
              <p className="font-display text-center text-2xl italic">Today at the counter</p>
              <div className="mx-auto mt-2 h-px w-24 bg-[#efeae0]/40" />
              <ul className="mt-6 space-y-4">
                {BOARD.map(({ item, available, note }) => (
                  <li key={item}>
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-lg">{item}</span>
                      <span className="menu-leader" />
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold tracking-widest uppercase ${
                          available
                            ? "bg-[#4f7a5d]/40 text-[#cfe8d6]"
                            : "bg-[#9c3d30] text-white"
                        }`}
                      >
                        {available ? "Available" : "Not available"}
                      </span>
                    </div>
                    {note ? (
                      <p className="mt-0.5 text-sm text-[#efeae0]/70 italic">{note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Features as a printed menu */}
        <section id="menu" className="scroll-mt-16 border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>What&apos;s on the menu</Eyebrow>
              <DisplayHeading className="mt-3">
                Everything from the first report to the final fix
              </DisplayHeading>
            </div>

            <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-border bg-background p-2 shadow-sm">
              <div className="grid gap-10 rounded-xl border-4 border-double border-border-strong px-6 py-10 sm:px-10 md:grid-cols-2">
                {MENU_SECTIONS.map((section) => (
                  <div key={section.heading}>
                    <h3 className="font-display text-center text-2xl text-primary italic">
                      {section.heading}
                    </h3>
                    <ul className="mt-6 space-y-6">
                      {section.items.map(([name, body]) => (
                        <li key={name}>
                          <div className="flex items-baseline gap-3">
                            <span className="font-display text-lg font-semibold">{name}</span>
                            <span className="menu-leader text-foreground" />
                            <span className="text-sm font-semibold text-primary">Included</span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Demo video */}
        <section id="demo" className="mx-auto w-full max-w-6xl scroll-mt-16 px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>See it in action</Eyebrow>
            <DisplayHeading className="mt-3">RepairLog in 90 seconds</DisplayHeading>
            <p className="mt-4 text-lg leading-8 text-muted">
              Set up a café, add a machine, report a fault from a phone and
              follow it to a verified repair.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-5xl">
            <DemoVideo />
          </div>
        </section>

        {/* How it works: kitchen order tickets */}
        <section id="how-it-works" className={`scroll-mt-16 ${ESPRESSO} text-[#f7f0e4]`}>
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Eyebrow light>How it works</Eyebrow>
              <DisplayHeading className="mt-3">
                Like a kitchen ticket, from order to served.
              </DisplayHeading>
            </div>
            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map(([title, body], index) => (
                <li
                  key={title}
                  className={`rounded-sm bg-[#fffaf2] p-5 text-[#2a1b12] shadow-lg shadow-black/30 lg:transition-transform lg:hover:rotate-0 ${
                    index % 2 === 0 ? "lg:-rotate-1" : "lg:rotate-1"
                  }`}
                >
                  <div className="flex items-center justify-between border-b-2 border-dashed border-[#c8b294] pb-3 font-mono text-xs tracking-widest text-[#6a5646] uppercase">
                    <span>Ticket</span>
                    <span>#{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="font-display mt-4 text-xl font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#6a5646]">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Trust</Eyebrow>
            <DisplayHeading className="mt-3">
              Your café&apos;s records stay in the back of house
            </DisplayHeading>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PRIVACY.map(({ icon: ItemIcon, title, body }) => (
              <article key={title} className={`${cardClasses} rounded-2xl p-6`}>
                <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <ItemIcon className="size-5" />
                </span>
                <h3 className="font-display mt-5 text-xl font-semibold">{title}</h3>
                <p className="mt-2 leading-7 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Pricing on the board */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.2fr_1fr] lg:py-20">
            <div>
              <Eyebrow>Pricing</Eyebrow>
              <DisplayHeading className="mt-3">One simple plan for one café</DisplayHeading>
              <p className="mt-4 max-w-md text-lg leading-8 text-muted">
                Every feature, up to 10 staff, unlimited reports. Payments are
                handled securely by Lemon Squeezy.
              </p>
            </div>
            <div className={`${CHALKBOARD} rounded-2xl border-8 border-[#6b4a32] p-7 text-[#efeae0] shadow-xl`}>
              {prices ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-xl">Monthly</span>
                    <span className="menu-leader" />
                    <span className="font-display text-3xl font-semibold tabular-nums">
                      {formatPrice(prices.monthly)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-3">
                    <span className="font-display text-xl">Yearly</span>
                    <span className="menu-leader" />
                    <span className="font-display text-3xl font-semibold tabular-nums">
                      {formatPrice(prices.yearly)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="font-display text-xl italic">
                  Start with a 15-day free trial.
                </p>
              )}
              <Link href="/pricing" className={`mt-7 w-full ${PILL_PRIMARY}`}>
                See full pricing
                <ArrowRightIcon />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-16 px-5 py-16 sm:px-8 lg:py-24">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <DisplayHeading className="mt-3">Questions owners ask</DisplayHeading>
          </div>
          <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-surface">
            {FAQ.map(([question, answer]) => (
              <details key={question} className="group px-5 sm:px-6">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {question}
                  <span
                    aria-hidden="true"
                    className="text-xl leading-none text-primary transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-5 leading-7 text-muted">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative isolate overflow-hidden text-[#f7f0e4]">
          <Image
            src="/images/home/espresso-pull.jpg"
            alt=""
            fill
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#1c120c]/75" />
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <h2 className="font-display max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Keep the coffee flowing.
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-[#eadfce]">
              Set up your café, add your first machine and print its QR label
              in about ten minutes.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/sign-in"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#f7f0e4] px-6 font-semibold text-[#2a1b12] transition-colors hover:bg-white"
              >
                Set up your café
                <ArrowRightIcon />
              </Link>
              <Link
                href="/support"
                className="inline-flex min-h-12 items-center font-semibold underline decoration-[#f7f0e4]/40 decoration-2 underline-offset-[6px] hover:decoration-[#f7f0e4]"
              >
                Talk to us first
              </Link>
            </div>
            <p className="mt-6 text-sm text-[#d9c9b4]">
              15-day free trial. No card needed.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
