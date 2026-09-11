import type { ReactNode } from "react";
import type { BadgeTone } from "@/lib/labels";
import { toneClasses, toneIcons } from "./tone";
import { cn } from "./utils";

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: BadgeTone;
  title?: string;
  children: ReactNode;
}) {
  const ToneIcon = toneIcons[tone];

  return (
    <div
      className={cn("rounded-2xl border px-4 py-3 text-sm", toneClasses[tone])}
    >
      {title ? (
        <p className="flex items-center gap-2 font-semibold">
          {ToneIcon ? (
            <ToneIcon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          ) : null}
          {title}
        </p>
      ) : null}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
