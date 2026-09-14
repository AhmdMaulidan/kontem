"use client";

import { useState } from "react";
import { IconChevronRight, cn } from "@/components/ui";

/** Transkrip bisa panjang — disembunyikan di balik toggle, bukan memaksa gulir. */
export function TranscriptToggle({ transcript }: { transcript: string | null }) {
  const [open, setOpen] = useState(false);

  if (!transcript) {
    return <p className="text-sm text-muted">Transkrip tidak tersedia.</p>;
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
      >
        <IconChevronRight
          className={cn("h-4 w-4 duration-200", open && "rotate-90")}
        />
        {open ? "Sembunyikan transkrip" : "Tampilkan transkrip"}
      </button>
      {open ? (
        <p className="mt-3 rounded-xl bg-surface-muted px-4 py-3 text-sm leading-relaxed text-body whitespace-pre-wrap">
          {transcript}
        </p>
      ) : null}
    </div>
  );
}
