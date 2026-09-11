import type { ReactNode } from "react";
import type { LucideIcon } from "./icon";
import { Card } from "./card";
import { cn } from "./utils";

const toneRing = {
  brand: "bg-brand-soft text-brand",
  accent: "bg-accent-soft text-accent-600",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
} as const;

/**
 * Metric chip — kartu angka dengan ikon mengambang di kiri, mengikuti pola
 * "floating metric widget" pada design.md bagian 2.3.
 */
export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "brand" | "accent" | "success" | "danger";
  icon?: LucideIcon;
}) {
  const StatIcon = icon;
  const valueTone =
    tone === "brand"
      ? "text-brand-700"
      : tone === "accent"
        ? "text-accent-600"
        : tone === "success"
          ? "text-success"
          : tone === "danger"
            ? "text-danger"
            : "text-foreground";

  return (
    <Card className="p-4" hover>
      <div className="flex items-start gap-3">
        {StatIcon ? (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              toneRing[tone ?? "brand"],
            )}
          >
            <StatIcon className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted">{label}</p>
          <p className={cn("tabular mt-1 text-2xl font-bold", valueTone)}>
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
      </div>
    </Card>
  );
}
