"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconCheck, IconCopy, IconX } from "./icon";

/**
 * Panel detail admin — dibuka dari kolom aksi sebuah baris tabel.
 *
 * Isinya dirender di server dan dioper sebagai `children`; komponen ini hanya
 * memegang keadaan terbuka/tertutup. Dengan begitu data baris tidak perlu
 * diserialkan jadi props satu per satu.
 */
export function DetailDrawer({
  label,
  title,
  subtitle,
  trigger = "link",
  icon,
  iconOnly = false,
  children,
}: {
  label: string;
  title: string;
  subtitle?: ReactNode;
  /** Kolom aksi tabel memakai tautan teks; ajakan di header memakai pil. */
  trigger?: "link" | "pill";
  icon?: ReactNode;
  /** Pil ajakan dirender sebagai lingkaran berisi ikon, tanpa teks. */
  iconOnly?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        className={
          trigger === "pill"
            ? iconOnly
              ? "grid h-10 w-10 place-items-center rounded-full bg-brand text-white shadow-brand transition-all hover:scale-[1.02] hover:bg-brand-600 active:scale-[0.98]"
              : "inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-brand transition-all hover:scale-[1.02] hover:bg-brand-600 active:scale-[0.98]"
            : icon
              ? "text-brand-600 transition-colors hover:text-brand-700"
              : "text-sm font-medium whitespace-nowrap text-brand-600 transition-colors hover:text-brand-700"
        }
      >
        {icon || label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[85vh] w-[480px] max-w-full flex-col overflow-y-auto rounded-3xl bg-surface shadow-float"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-3xl border-b border-line bg-surface px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold">{title}</h2>
                {subtitle ? (
                  <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup panel"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <IconX className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-5 px-5 py-5">{children}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

/** Tombol salin teks pendek — nomor PIC, nomor rekening. */
/** Tombol salin teks pendek — nomor PIC, nomor rekening. */
export function CopyButton({
  value,
  label,
  iconOnly = false,
}: {
  value: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const [tersalin, setTersalin] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => setTersalin(true),
          // Clipboard ditolak browser saat halaman tidak fokus atau izinnya
          // dicabut; diam-diam gagal lebih buruk daripada label yang jujur.
          () => setTersalin(false),
        );
      }}
      title={iconOnly ? (tersalin ? "Tersalin" : "Salin") : undefined}
      className={
        iconOnly
          ? "text-brand-600 transition-colors hover:text-brand-700"
          : "shrink-0 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
      }
    >
      {iconOnly ? (
        tersalin ? (
          <IconCheck className="h-4 w-4" strokeWidth={2} />
        ) : (
          <IconCopy className="h-4 w-4" strokeWidth={2} />
        )
      ) : (
        <>
          {tersalin ? "Tersalin" : (label ?? "Salin")}
        </>
      )}
    </button>
  );
}
