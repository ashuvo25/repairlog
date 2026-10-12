import Link from "next/link";

export function Logo({ href = "/" }: Readonly<{ href?: string }>) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-foreground"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          transform="translate(7 7) scale(0.75)"
          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
          fill="none"
          stroke="#fffdf8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      RepairLog
    </Link>
  );
}
