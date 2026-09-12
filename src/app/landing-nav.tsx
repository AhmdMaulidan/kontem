"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink, IconPin, cn } from "@/components/ui";

const menu = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#campaign", label: "Campaign" },
  { href: "#faq", label: "FAQ" },
];

/**
 * Nav halaman depan.
 *
 * Di puncak halaman ia melayang tanpa latar di atas panel biru hero — bidang
 * birunya jadi terbaca utuh sampai ke tepi atas layar (design.md bagian 5.1).
 * Begitu halaman digulir, nav menempel di atas dan berlatar putih, karena di
 * bawah hero latarnya terang: tulisan putih tanpa latar akan hilang di sana.
 */
export function LandingNav() {
  const [digulir, setDigulir] = useState(false);

  useEffect(() => {
    // Ambang 8px, bukan 0: sebagian browser mengembalikan scrollY pecahan
    // kecil saat halaman dibuka dari posisi tersimpan, dan nav akan berkedip
    // antara dua keadaan kalau ambangnya nol.
    const perbarui = () => setDigulir(window.scrollY > 8);
    perbarui();
    window.addEventListener("scroll", perbarui, { passive: true });
    return () => window.removeEventListener("scroll", perbarui);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-200",
        digulir
          ? "border-b border-line bg-surface/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 transition-all duration-200",
          digulir ? "py-3" : "py-5",
        )}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              digulir ? "bg-brand text-white" : "bg-white text-brand-600",
            )}
          >
            <IconPin className="h-4.5 w-4.5" strokeWidth={2.5} />
          </span>
          <span
            className={cn(
              "font-display text-xl font-bold transition-colors",
              digulir ? "text-brand-600" : "text-white",
            )}
          >
            Kontem
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {menu.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-semibold transition-colors",
                digulir
                  ? "text-brand-600 hover:text-brand-700"
                  : "text-white hover:text-white/80",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink
            href="/login"
            variant={digulir ? "outlineBrand" : "outlineLight"}
            size="sm"
          >
            Masuk
          </ButtonLink>
          <ButtonLink href="/register" size="sm">
            Daftar
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
