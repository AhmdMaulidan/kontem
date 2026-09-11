import { cn } from "./utils";

/** Bar horizontal untuk proporsi views / serapan budget. */
export function ProgressBar({
  value,
  max,
  tone = "brand",
}: {
  value: number;
  max: number;
  tone?: "brand" | "success" | "warning" | "accent";
}) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bg =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "accent"
          ? "bg-accent"
          : "bg-gradient-to-r from-brand-400 to-brand-600";

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
      <div
        className={cn("h-full rounded-full transition-all", bg)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
