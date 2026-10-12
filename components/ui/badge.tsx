import {
  CONDITION_LABELS,
  type EquipmentCondition,
} from "@/lib/modules/equipment/conditions";

type BadgeTone = "positive" | "attention" | "danger" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  positive: "border-success-border bg-success-soft text-success",
  attention: "border-attention-border bg-attention-soft text-attention",
  danger: "border-danger-border bg-danger-soft text-danger",
  neutral: "border-border bg-subtle text-muted",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  positive: "bg-success",
  attention: "bg-attention",
  danger: "bg-danger",
  neutral: "bg-muted",
};

const CONDITION_TONES: Record<EquipmentCondition, BadgeTone> = {
  operational: "positive",
  unavailable: "danger",
  unknown: "attention",
};

export function Badge({
  tone = "neutral",
  children,
}: Readonly<{ tone?: BadgeTone; children: React.ReactNode }>) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${DOT_CLASSES[tone]}`}
      />
      {children}
    </span>
  );
}

export function ConditionBadge({
  condition,
}: Readonly<{ condition: EquipmentCondition }>) {
  return (
    <Badge tone={CONDITION_TONES[condition]}>
      {CONDITION_LABELS[condition]}
    </Badge>
  );
}
