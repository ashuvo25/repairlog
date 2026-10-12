export const cardClasses =
  "rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(23,37,29,0.04)]";

export function Card({
  title,
  description,
  children,
  className = "",
}: Readonly<{
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <section className={`${cardClasses} p-5 sm:p-6 ${className}`}>
      {title ? (
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      ) : null}
      {description ? (
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      ) : null}
      <div className={title || description ? "mt-5" : ""}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  help,
}: Readonly<{ label: string; value: number | string; help?: string }>) {
  return (
    <article className={`${cardClasses} p-5`}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="font-display mt-2 text-4xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {help ? <p className="mt-2 text-sm leading-6 text-muted">{help}</p> : null}
    </article>
  );
}
