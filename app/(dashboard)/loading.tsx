export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10"
    >
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-4 w-32 rounded bg-border" />
        <div className="mt-3 h-9 w-56 rounded bg-border" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 rounded-xl bg-border/70" />
          ))}
        </div>
        <div className="mt-6 h-64 rounded-xl bg-border/50" />
      </div>
    </main>
  );
}
