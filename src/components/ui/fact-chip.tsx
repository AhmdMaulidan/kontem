import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * Chip pil pada baris fakta kartu katalog — design.md bagian 6.3.
 *
 * Bentuknya sama dengan Badge, tapi berlatar brand transparan dan bertulisan
 * SemiBold; dipakai untuk keterangan pendek di ujung kanan baris fakta.
 */
export function FactChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-brand/30 px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap text-brand-600 lg:text-[11px]",
        className,
      )}
    >
      {children}
    </span>
  );
}
