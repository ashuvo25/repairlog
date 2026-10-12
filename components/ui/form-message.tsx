export function FormMessage({
  children,
  tone,
}: Readonly<{
  children: React.ReactNode;
  tone: "error" | "success";
}>) {
  const classes =
    tone === "error"
      ? "border-danger-border bg-danger-soft text-danger"
      : "border-success-border bg-success-soft text-success";

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm leading-6 ${classes}`}
    >
      {children}
    </p>
  );
}
