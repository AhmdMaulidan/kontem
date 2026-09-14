"use client";

import { useState } from "react";
import { Button, Callout } from "@/components/ui";

/**
 * Aksi yang bentuknya sudah disepakati tapi server action-nya belum ditulis.
 *
 * Tombolnya tetap dirender dan tetap memberi umpan balik saat ditekan: tombol
 * yang diam membuat penguji mengira halamannya rusak, sedangkan tombol yang
 * dihilangkan menyembunyikan bentuk layar yang justru sedang dinilai.
 */
export function NotWiredButton({
  label,
  variant = "primary",
  shape = "pill",
  size = "sm",
  icon,
  iconOnly = false,
}: {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "outlineBrand";
  shape?: "pill" | "block";
  size?: "sm" | "md" | "compact";
  icon?: React.ReactNode;
  iconOnly?: boolean;
}) {
  const [ditekan, setDitekan] = useState(false);

  return (
    <div className={iconOnly ? "" : "space-y-2"}>
      <Button
        type="button"
        variant={variant}
        shape={shape}
        size={size}
        title={iconOnly ? label : undefined}
        onClick={() => setDitekan(true)}
      >
        {icon && iconOnly ? icon : label}
      </Button>
      {ditekan && !iconOnly ? (
        <Callout tone="info">
          Tampilan saja — aksi ini belum tersambung ke server.
        </Callout>
      ) : null}
    </div>
  );
}

/** Varian tautan teks untuk kolom aksi di dalam tabel. */
export function NotWiredLink({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) {
  const [ditekan, setDitekan] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setDitekan(true)}
      title={icon ? label : (ditekan ? undefined : "Belum tersambung ke server")}
      className={icon ? "text-brand-600 transition-colors hover:text-brand-700" : "text-sm font-medium whitespace-nowrap text-brand-600 transition-colors hover:text-brand-700"}
    >
      {ditekan && !icon ? "Belum tersambung" : (icon || label)}
    </button>
  );
}
