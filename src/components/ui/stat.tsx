import type { ReactNode } from "react";
import type { LucideIcon } from "./icon";
import { Card } from "./card";
import { cn } from "./utils";

const toneRing = {
  brand: "bg-brand-soft text-brand-600",
  accent: "bg-accent-soft text-accent-600",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
} as const;

/**
 * Kartu angka dasbor — design.md bagian 6.2.
 *
 * Angkanya SELALU navy `--foreground`. Warna di kartu ini hanya dipakai pada
 * kotak ikon dan keterangan di bawahnya: angka berwarna-warni membuat mata
 * membandingkan warnanya, padahal yang perlu dibandingkan nilainya. Ini juga
 * yang ditetapkan bagian 2.1 — navy untuk "judul dan angka penting".
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

  return (
    <Card className="p-4" hover>
      <div className="flex items-start gap-3">
        {StatIcon ? (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              toneRing[tone ?? "brand"],
            )}
          >
            <StatIcon className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="tabular mt-1 font-display text-2xl font-bold text-foreground">
            {value}
          </p>
          {hint ? (
            <p
              className={cn(
                "mt-1 text-xs",
                tone === "danger" ? "font-medium text-danger" : "text-muted",
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
