import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * Kartu — design.md bagian 2.3.
 *
 * `soft` dipakai untuk kartu berlatar biru pucat tanpa garis tepi (kartu
 * keunggulan di halaman depan), `panel` untuk kartu besar berradius 24px.
 * Keduanya prop, bukan kelas yang dioper lewat `className`, karena `cn()`
 * hanya menyambung string — latar dan radius yang bertabrakan akan diputuskan
 * urutan stylesheet, bukan yang ditulis belakangan.
 */
export function Card({
  className,
  float,
  hover,
  soft,
  panel,
  children,
}: {
  className?: string;
  float?: boolean;
  hover?: boolean;
  soft?: boolean;
  panel?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "p-5",
        panel ? "rounded-3xl" : "rounded-2xl",
        soft ? "bg-brand-50" : "border border-line bg-surface",
        soft ? null : float ? "shadow-float" : "shadow-card",
        hover && "card-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
