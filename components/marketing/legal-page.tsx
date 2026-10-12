// Shared layout for long-form policy pages.
export function LegalPage({
  title,
  lastUpdated,
  children,
}: Readonly<{ title: string; lastUpdated: string; children: React.ReactNode }>) {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {lastUpdated}</p>
      <div className="mt-8 space-y-8 leading-7 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
