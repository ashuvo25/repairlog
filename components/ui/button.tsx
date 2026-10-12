type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary:
    "border border-border bg-white text-foreground hover:border-border-strong hover:bg-subtle",
  danger:
    "border border-danger-border bg-danger-soft text-danger hover:border-danger",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

// Shared by <Button> and by links that should look like buttons.
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: Readonly<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}> = {}) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  fullWidth,
  type = "button",
  ...props
}: Readonly<
  Omit<React.ComponentProps<"button">, "className"> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
  }
>) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth })}
      {...props}
    />
  );
}
