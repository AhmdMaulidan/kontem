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
  const ToneIcon = toneIcons[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      {icon && ToneIcon ? (
        <ToneIcon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

/** Pill dekoratif untuk penanda seksi. */
export function PillLabel({
  tone = "sky",
  icon: PillIcon,
  children,
}: {
  tone?: BadgeTone;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      {PillIcon ? <PillIcon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}
