"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

export type SlideHero = {
  /** Bagian judul yang ditulis putih. */
  judul: string;
  /** Sambungan judul yang ditulis navy — penekanan kalimatnya. */
  judulTekan: string;
  deskripsi: string;
};

/** Jeda antar-slide. Cukup panjang untuk membaca dua kalimat tanpa terburu. */
const JEDA = 6000;

/**
 * Judul dan deskripsi hero yang berganti sendiri.
 *
 * Hanya teksnya yang berganti — ilustrasi dan kedua tombol tetap diam
 * (keputusan pemilik produk). Itu sebabnya komponen ini hanya membungkus
 * blok teks, bukan seluruh kolom kiri hero: tombol tetap dirender
 * `page.tsx` sebagai Server Component.
 *
 * Tingginya DIPATOK lewat grid bertumpuk (semua slide dirender di sel yang
 * sama, yang tidak aktif `invisible`) supaya panel biru tidak berubah tinggi
 * tiap pergantian — hero yang tersentak naik-turun terbaca seperti halaman
 * yang belum selesai dimuat.
 */
export function HeroSlider({ slides }: { slides: SlideHero[] }) {
  const [aktif, setAktif] = useState(0);
  // Ditahan saat kursor di atas teks: pengunjung yang sedang membaca tidak
  // kehilangan kalimatnya di tengah jalan.
  const [tertahan, setTertahan] = useState(false);
  const jumlah = slides.length;

  useEffect(() => {
    if (jumlah < 2 || tertahan) return;
    // Pengunjung yang menyetel prefers-reduced-motion tidak digeser otomatis —
    // aturan yang sama dengan angka hitung-naik dan animasi roadmap
    // (design.md bagian 5.1). Titik indikatornya tetap bisa diklik.
    const diam = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (diam.matches) return;

    const jadwal = window.setInterval(() => {
      setAktif((i) => (i + 1) % jumlah);
    }, JEDA);
    return () => window.clearInterval(jadwal);
  }, [jumlah, tertahan]);

  return (
    <div
      onMouseEnter={() => setTertahan(true)}
      onMouseLeave={() => setTertahan(false)}
    >
      {/* Semua slide ditumpuk di satu sel grid. Yang tidak aktif tetap ikut
          menentukan tinggi wadah, jadi tingginya dipatok oleh slide terpanjang
          dan tidak berubah saat berganti. `invisible` dipakai, bukan
          `hidden`: elemen yang dilepas dari alur tidak lagi menyumbang
          tinggi. */}
      <div className="grid">
        {slides.map((s, i) => {
          const ini = i === aktif;
          return (
            <div
              key={s.judul}
              className={cn(
                "col-start-1 row-start-1 transition-opacity duration-500",
                ini ? "opacity-100" : "invisible opacity-0",
              )}
              // Slide yang sedang tidak tampil disembunyikan dari pembaca
              // layar supaya kalimatnya tidak dibacakan beruntun sebagai satu
              // paragraf panjang.
              aria-hidden={!ini}
            >
              <h1 className="font-display text-[1.6rem] leading-[1.18] font-bold tracking-tight text-white drop-shadow-[0_2px_4px_rgba(2,132,199,0.2)] sm:text-3xl lg:text-[2.6rem]">
                {s.judul}{" "}
                <span className="block text-brand-700">{s.judulTekan}</span>
              </h1>
              <p className="mt-3.5 max-w-xl text-sm font-medium text-foreground lg:text-lg lg:leading-relaxed">
                {s.deskripsi}
              </p>
            </div>
          );
        })}
      </div>

      {/* Titik indikator. Tombol sungguhan, bukan <span> berpenanda klik,
          supaya bisa dicapai keyboard. */}
      {jumlah > 1 && (
        <div className="mt-5 flex justify-center gap-2 lg:justify-start">
          {slides.map((s, i) => (
            <button
              key={s.judul}
              type="button"
              onClick={() => setAktif(i)}
              aria-label={`Tampilkan slide ${i + 1}: ${s.judul} ${s.judulTekan}`}
              aria-current={i === aktif}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === aktif
                  ? "w-7 bg-brand-700"
                  : "w-2 bg-white/70 hover:bg-white",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
