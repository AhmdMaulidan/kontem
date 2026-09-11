import type { ReactNode } from "react";
import type { BadgeTone } from "@/lib/labels";
import { toneClasses, toneDotClasses } from "./tone";
import { cn } from "./utils";

export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: BadgeTone;
  /** Tampilkan titik penanda status di sebelah kiri label. */
  icon?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        // Ukuran sengaja ditahan di 11px/medium: badge adalah keterangan,
        // bukan judul. Pill setebal teks isi membuat tiap baris tabel
        // berebut perhatian.
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      {icon ? (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toneDotClasses[tone])}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
