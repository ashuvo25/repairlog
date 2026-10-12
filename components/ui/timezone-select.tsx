import { inputClasses } from "@/components/ui/field";
import { isUsTimezone, US_TIMEZONES } from "@/lib/modules/organizations/timezones";

export function TimezoneSelect({
  value,
  defaultValue,
  onChange,
}: Readonly<{
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}>) {
  // A café created before the US-only list keeps its saved zone selectable.
  const saved = value ?? defaultValue;
  const extraZone = saved && !isUsTimezone(saved) ? saved : null;

  return (
    <span className="relative block">
      <select
        name="timezone"
        value={value}
        defaultValue={defaultValue}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={`${inputClasses} appearance-none pr-10`}
      >
        {extraZone ? <option value={extraZone}>{extraZone}</option> : null}
        {US_TIMEZONES.map((zone) => (
          <option key={zone.value} value={zone.value}>
            {zone.label} — {zone.example}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 mt-1 size-4 -translate-y-1/2 text-muted"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}
