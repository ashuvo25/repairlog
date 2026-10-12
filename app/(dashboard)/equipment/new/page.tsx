import type { Metadata } from "next";

import { BackLink, PageHeader } from "@/components/layout/page-header";
import { Card, cardClasses } from "@/components/ui/card";
import { CheckIcon, QrIcon } from "@/components/ui/icons";
import { requireOwner } from "@/lib/permissions/current-membership";

import { NewEquipmentForm } from "../equipment-form";

export const metadata: Metadata = {
  title: "Add equipment",
};

const NEXT_STEPS = [
  "A QR label is created for this machine straight away.",
  "Its condition starts as Unknown until you confirm it.",
  "You can rename or archive it at any time.",
] as const;

export default async function NewEquipmentPage() {
  await requireOwner();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
      <BackLink href="/equipment">Back to equipment</BackLink>
      <div className="mt-4">
        <PageHeader
          title="Add a machine"
          description="Add anything that can break: machines, fridges, furniture, fixtures."
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card title="Machine details">
          <NewEquipmentForm />
        </Card>

        <aside className={`${cardClasses} p-5 sm:p-6`}>
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <QrIcon className="size-5" />
          </span>
          <h2 className="mt-4 text-sm font-semibold">What happens next</h2>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-muted">
            {NEXT_STEPS.map((step) => (
              <li key={step} className="flex gap-2.5">
                <CheckIcon className="mt-1 size-4 text-primary" />
                {step}
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-muted">
            Scanning the label shows only your café name and this
            machine&apos;s name and category.
          </p>
        </aside>
      </div>
    </main>
  );
}
