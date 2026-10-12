import type { Metadata } from "next";

import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireOwner } from "@/lib/permissions/current-membership";

export const metadata: Metadata = {
  title: "Export data",
};

const EXPORTS = [
  {
    dataset: "equipment",
    title: "Equipment",
    body: "Every machine, its category and confirmed condition.",
  },
  {
    dataset: "tickets",
    title: "Tickets",
    body: "All faults with status, priority and dates.",
  },
  {
    dataset: "repair-history",
    title: "Repair history",
    body: "Work done, technician and date for every repair.",
  },
  {
    dataset: "costs",
    title: "Repair costs",
    body: "Every recorded cost with its date and machine.",
  },
] as const;

export default async function ExportSettingsPage() {
  await requireOwner();

  return (
    <Card
      title="Export your data"
      description="Download CSV files that open in Excel, Google Sheets or Numbers. Your data stays yours."
    >
      <ul className="divide-y divide-border">
        {EXPORTS.map((item) => (
          <li
            key={item.dataset}
            className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-muted">{item.body}</p>
            </div>
            <a
              href={`/api/exports/${item.dataset}`}
              download
              className={buttonClasses({ variant: "secondary" })}
            >
              Download CSV
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
