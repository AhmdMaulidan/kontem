import type { LucideIcon } from "lucide-react";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconCoffee,
  IconPin,
  IconStar,
  IconWallet,
} from "./icon";
import type { BadgeTone } from "@/lib/labels";

/**
 * Peta warna status yang dipakai bersama Badge dan Callout, mengikuti matriks
 * design.md bagian 6.3 — tiap status punya trio latar / teks / garis tepi
 * sendiri supaya "warning" selalu tampil sama di seluruh aplikasi.
 */
export const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-muted border-line",
  info: "bg-info-soft text-info border-info-line",
  success: "bg-success-soft text-success border-success-line",
  warning: "bg-warning-soft text-warning border-warning-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  sky: "bg-sky-soft text-sky-deep border-sky-line",
  teal: "bg-teal-soft text-teal-deep border-teal-line",
  accent: "bg-accent-soft text-accent-600 border-accent-100",
};

/** Ikon penanda status, sesuai kolom Icon pada matriks design.md. */
export const toneIcons: Record<BadgeTone, LucideIcon | null> = {
  neutral: null,
  info: IconClock,
  success: IconCheck,
  warning: IconPin,
  danger: IconAlert,
  sky: IconCoffee,
  teal: IconWallet,
  accent: IconStar,
};

/**
 * Titik penanda status. Dipakai menggantikan ikon di dalam badge supaya
 * pill-nya bisa dibuat kecil tanpa kehilangan pembeda antar status.
 */
export const toneDotClasses: Record<BadgeTone, string> = {
  neutral: "bg-muted",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  sky: "bg-sky-deep",
  teal: "bg-teal-deep",
  accent: "bg-accent",
};
