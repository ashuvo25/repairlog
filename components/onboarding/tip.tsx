import { dismissTip } from "@/app/(dashboard)/help-actions";
import { getUserPreferences, TIPS, type TipKey } from "@/lib/modules/onboarding/tips";

// A dismissible one-line hint. Dismissal is saved per person.
export async function Tip({ tipKey }: Readonly<{ tipKey: TipKey }>) {
  const preferences = await getUserPreferences();

  if (preferences.dismissedTips.has(tipKey)) {
    return null;
  }

  return (
    <aside className="flex items-start justify-between gap-3 rounded-lg border border-primary-border bg-primary-soft px-4 py-3 text-sm leading-6 text-primary">
      <p>
        <span className="font-semibold">Tip: </span>
        {TIPS[tipKey]}
      </p>
      <form action={dismissTip} className="shrink-0">
        <input type="hidden" name="tipKey" value={tipKey} />
        <button
          type="submit"
          className="-my-1 inline-flex min-h-9 items-center rounded-md px-2 font-semibold underline-offset-2 hover:underline"
          aria-label="Dismiss this tip"
        >
          Dismiss
        </button>
      </form>
    </aside>
  );
}
