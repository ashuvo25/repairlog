export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "awaiting_verification",
  "resolved",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

type Tone = "positive" | "attention" | "danger" | "neutral";

export const STATUS_LABELS: Record<TicketStatus, { label: string; tone: Tone }> = {
  open: { label: "Reported", tone: "danger" },
  in_progress: { label: "Being repaired", tone: "attention" },
  awaiting_verification: { label: "Owner check", tone: "attention" },
  resolved: { label: "Fixed", tone: "positive" },
};

export const PRIORITY_LABELS: Record<TicketPriority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "neutral" },
  high: { label: "High", tone: "attention" },
  urgent: { label: "Urgent", tone: "danger" },
};

export function isTicketStatus(value: string): value is TicketStatus {
  return TICKET_STATUSES.includes(value as TicketStatus);
}

export function isTicketPriority(value: string): value is TicketPriority {
  return TICKET_PRIORITIES.includes(value as TicketPriority);
}

// Today's calendar date where the café is, as YYYY-MM-DD.
export function todayInTimezone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Parses a typed amount such as "45" or "45.50" into cents. Returns null for
// an empty field and undefined for anything that is not a valid amount.
export function parseAmountToMinor(value: string): number | null | undefined {
  const trimmed = value.trim().replace(/^\$/, "").replace(/,/g, "");

  if (trimmed === "") {
    return null;
  }

  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) {
    return undefined;
  }

  return Math.round(Number(trimmed) * 100);
}

export function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    minor / 100,
  );
}
