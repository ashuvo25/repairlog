import { markStaffIntroSeen } from "@/app/(dashboard)/help-actions";
import { buttonClasses } from "@/components/ui/button";
import { cardClasses } from "@/components/ui/card";
import { getUserPreferences } from "@/lib/modules/onboarding/tips";

const STEPS = [
  "Notice a problem with a machine? Tap Report a fault, or scan the QR label on it.",
  "Describe what you see. The owner is told straight away.",
  "Follow progress on Tickets. The owner confirms when a repair is done.",
] as const;

// Shown once to staff on their first visit.
export async function StaffIntro() {
  const preferences = await getUserPreferences();

  if (preferences.staffIntroSeen) {
    return null;
  }

  return (
    <section className={`${cardClasses} mt-6 border-primary-border p-5 sm:p-6`}>
      <h2 className="text-lg font-semibold tracking-tight">
        Welcome to the team on RepairLog
      </h2>
      <ol className="mt-4 space-y-3">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 leading-6">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <form action={markStaffIntroSeen} className="mt-5">
        <button type="submit" className={buttonClasses()}>
          Got it
        </button>
      </form>
    </section>
  );
}
