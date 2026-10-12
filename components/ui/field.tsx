export const inputClasses =
  "mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3.5 text-base text-foreground placeholder:text-muted/70 hover:border-border-strong";

export function Field({
  label,
  hint,
  children,
}: Readonly<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}>) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint ? (
        <span className="mt-2 block text-sm leading-6 text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
