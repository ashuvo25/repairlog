import { CheckIcon, WrenchIcon } from "@/components/ui/icons";

// The rl-* animation classes live in globals.css and share one 10s timeline:
// a = reported, b = accepted, c = repaired, d = verified.
const SHOW = {
  a: "rl-show-a",
  b: "rl-show-b",
  c: "rl-show-c",
  d: "rl-show-d",
} as const;

const STEPS = [
  { label: "Report", show: SHOW.a },
  { label: "Review", show: SHOW.b },
  { label: "Repair", show: SHOW.c },
  { label: "Verify", show: SHOW.d },
] as const;

const ACTIVITY = [
  { text: "Fault reported from the QR label", meta: "9:02", show: SHOW.a },
  { text: "Owner accepted it into a ticket", meta: "9:10", show: SHOW.b },
  { text: "Technician replaced the group gasket", meta: "11:45", show: SHOW.c },
  { text: "Owner verified the repair", meta: "12:05", show: SHOW.d },
] as const;

// Decorative QR-like pattern; it does not encode anything.
const QR_ROWS = [
  "1111111001011111110",
  "1000001010101000001",
  "1011101011001011101",
  "1011101001101011101",
  "1011101010101011101",
  "1000001001001000001",
  "1111111010101111111",
  "0000000011000000000",
  "1010111001101101011",
  "0110100110010110100",
  "1101011011101001101",
  "0000000010011010010",
  "1111111001101011011",
  "1000001011010010100",
  "1011101010011101101",
  "1011101001100110010",
  "1011101011011011101",
  "1000001010100100110",
  "1111111001011011011",
] as const;

function QrGraphic() {
  return (
    <svg
      viewBox="0 0 19 19"
      shapeRendering="crispEdges"
      className="size-full text-foreground"
    >
      {QR_ROWS.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "1" ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill="currentColor"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

const BADGE_BASE =
  "col-start-1 row-start-1 justify-self-end rounded-full border px-2.5 py-1 text-xs font-semibold";

export function RepairFlowScene() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      {/* QR label being scanned */}
      <div className="absolute -top-20 -left-10 z-10 w-36 rl-float">
        <div className="-rotate-6 rounded-2xl bg-white p-3 shadow-2xl">
          <div className="relative overflow-hidden rounded-lg">
            <QrGraphic />
            <span className="absolute inset-x-0 top-1/2 h-0.5 bg-primary shadow-[0_0_12px_3px_rgba(53,95,71,0.55)] rl-scan" />
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold text-foreground">
            Scan to report
          </p>
        </div>
      </div>

      {/* Ticket moving through the repair flow */}
      <div className="relative rounded-2xl bg-surface p-6 text-foreground shadow-2xl">
        <div className="flex items-start justify-between gap-4 pl-24">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">Ticket · Coffee</p>
            <p className="mt-0.5 truncate text-lg font-semibold tracking-tight">
              Espresso machine
            </p>
          </div>
          <div className="grid shrink-0">
            <span
              className={`${BADGE_BASE} border-attention-border bg-attention-soft text-attention rl-window-a motion-reduce:hidden`}
            >
              Reported
            </span>
            <span
              className={`${BADGE_BASE} border-border bg-subtle text-foreground rl-window-b motion-reduce:hidden`}
            >
              In progress
            </span>
            <span
              className={`${BADGE_BASE} border-primary-border bg-primary-soft text-primary ${SHOW.d}`}
            >
              Resolved
            </span>
          </div>
        </div>

        <div className="relative mt-8">
          <div className="absolute inset-x-[12.5%] top-3.5 h-0.5 bg-border">
            <div
              className={`size-full origin-left bg-primary rl-progress`}
            />
          </div>
          <ol className="relative grid grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.label} className="flex flex-col items-center gap-2">
                <span className="relative flex size-7 items-center justify-center rounded-full border-2 border-border bg-surface">
                  <span
                    className={`absolute -inset-0.5 flex items-center justify-center rounded-full bg-primary text-white ${step.show}`}
                  >
                    <CheckIcon className="size-3.5" />
                  </span>
                </span>
                <span className="text-xs font-semibold">{step.label}</span>
              </li>
            ))}
          </ol>
        </div>

        <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
          {ACTIVITY.map((item) => (
            <li
              key={item.text}
              className={`flex items-center justify-between gap-3 text-sm [--rl-shift:8px] ${item.show}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="truncate">{item.text}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {item.meta}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Repair chip */}
      <div className="absolute -right-6 -bottom-16 flex items-center gap-3 rounded-xl bg-white py-3 pr-5 pl-3 text-foreground shadow-2xl rl-float-slow">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-white">
          <WrenchIcon className="size-5 origin-center rl-rock" />
        </span>
        <span>
          <span className="block text-sm font-semibold">Repair recorded</span>
          <span className="block text-xs text-muted">Gasket · $40</span>
        </span>
      </div>
    </div>
  );
}
