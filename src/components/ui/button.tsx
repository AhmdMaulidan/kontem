import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./utils";

/**
 * Tombol design system — design.md bagian 6.1.
 *
 * Ada dua bentuk dan bedanya bermakna: **pil** untuk ajakan halaman, **blok**
 * `rounded-lg` selebar induknya untuk aksi di dalam kartu katalog dan tombol
 * form. Pil selebar kartu membuat aksi milik kartu terbaca sebagai ajakan
 * utama halaman.
 */
const buttonBase =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

/**
 * Warna permukaan saja. Bayangan dan efek angkat sengaja dipisah ke
 * `variantElevation` supaya bentuk blok bisa meniadakannya tanpa mengandalkan
 * kelas penimpa — `cn()` hanya menyambung string, dua kelas `shadow-*` yang
 * bertabrakan diputuskan urutan stylesheet, bukan urutan penulisan.
 */
export const buttonVariants = {
  primary: "bg-brand text-white hover:bg-brand-600",
  secondary:
    "bg-surface text-body border border-line hover:bg-surface-muted hover:border-line-brand",
  accent: "bg-accent text-white hover:bg-accent-600",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-muted hover:bg-brand-soft hover:text-brand-600",
  // Aksi sekunder yang tetap setara pentingnya dengan primary — dipakai
  // berdampingan supaya keduanya terbaca sebagai pilihan, bukan satu utama
  // dan satu netral.
  outlineBrand:
    "border border-brand-200 bg-surface text-brand-700 hover:border-brand-400 hover:bg-brand-50",
  // Tombol di atas panel biru hero: hanya garis tepi putih, terisi saat hover.
  outlineLight:
    "border border-white/70 text-white hover:bg-white hover:text-brand-600",
} as const;

/** Bayangan per varian; hanya dipakai bentuk pil. */
const variantElevation = {
  primary: "shadow-brand",
  secondary: "shadow-card",
  accent: "shadow-[0_8px_18px_-6px_rgba(250,191,24,0.5)]",
  danger: "",
  ghost: "",
  outlineBrand: "",
  outlineLight: "",
} as const;

/**
 * Ukuran ditaruh di prop tersendiri, bukan dioper lewat `className`, karena
 * `cn()` hanya menyambung string — dua kelas padding yang bertabrakan akan
 * diputuskan oleh urutan stylesheet, bukan oleh yang ditulis belakangan.
 */
export const buttonSizes = {
  sm: "px-5 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-10 py-3.5 text-[15px] lg:py-4 lg:text-lg",
  compact: "px-3 py-2 text-sm",
} as const;

/** Bentuk blok mengatur paddingnya sendiri — design.md bagian 6.1. */
const blockShape =
  "w-full rounded-lg py-2.5 text-center text-sm font-medium lg:text-base";

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;
export type ButtonShape = "pill" | "block";

export function buttonClass(
  variant: ButtonVariant,
  size: ButtonSize,
  shape: ButtonShape,
  className?: string,
) {
  return cn(
    buttonBase,
    buttonVariants[variant],
    shape === "block"
      ? blockShape
      : cn(
          "rounded-full hover:scale-[1.02] active:scale-[0.98]",
          buttonSizes[size],
          variantElevation[variant],
        ),
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  shape = "pill",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
}) {
  return (
    <button {...props} className={buttonClass(variant, size, shape, className)} />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  shape = "pill",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
}) {
  return (
    <Link {...props} className={buttonClass(variant, size, shape, className)} />
  );
}
