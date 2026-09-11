import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * Kartu putih membulat dengan bayangan difus — design.md bagian 2.3.
 * `float` untuk kartu sorotan, `hover` untuk kartu yang bisa diklik.
 */
export function Card({
  className,
  float,
  hover,
  children,
}: {
  className?: string;
  float?: boolean;
  hover?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-5",
        float ? "shadow-float" : "shadow-card",
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
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
