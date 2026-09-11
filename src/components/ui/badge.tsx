import type { ReactNode } from "react";
import type { BadgeTone } from "@/lib/labels";
import { toneClasses, toneIcons } from "./tone";
import { cn } from "./utils";

export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: BadgeTone;
  /** Tampilkan ikon penanda status bawaan tone. */
  icon?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      {icon && toneIcons[tone] ? <span aria-hidden>{toneIcons[tone]}</span> : null}
      {children}
    </span>
  );
}

/** Pill dekoratif untuk penanda seksi, mis. "✨ Kenapa Kontem Lebih Unggul". */
export function PillLabel({
  tone = "sky",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
