"use client";

import { useEffect, useRef, useState } from "react";
import { formatCompact, formatNumber } from "@/lib/format";

/**
 * Angka yang menghitung naik saat kubahnya masuk layar.
 *
 * Nilai akhirnya dirender di server, bukan nol: tanpa JavaScript, pada mesin
 * pencari, dan sebelum hidrasi, yang terbaca tetap angka sebenarnya. Hitungan
 * baru dimulai setelah komponen mendekati layar — kalau dimulai saat halaman
 * dimuat, animasinya sudah selesai sebelum pengunjung sampai ke seksi ini.
 */
export function CountUp({
  value,
  compact,
  className,
  durasi = 1400,
}: {
  value: number;
  /** Format ringkas ("467,9 rb") seperti kartu statistik. */
  compact?: boolean;
  className?: string;
  durasi?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [tampil, setTampil] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    // Pengunjung yang meminta gerak dikurangi langsung melihat angka akhirnya.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();

        const mulai = performance.now();
        const langkah = (sekarang: number) => {
          // Dijepit dari bawah juga: stempel waktu yang diterima rAF adalah
          // saat frame-nya dimulai, dan itu bisa lebih awal daripada
          // `performance.now()` yang dicatat sesaat sebelum frame dijadwalkan.
          // Tanpa penjepit itu `t` sempat negatif dan kubahnya berkedip
          // menampilkan angka minus.
          const t = Math.min(1, Math.max(0, (sekarang - mulai) / durasi));
          // easeOutCubic: cepat di awal lalu melambat mendekati angka akhir,
          // supaya berhenti di angkanya terasa mendarat, bukan terpotong.
          setTampil(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) raf = requestAnimationFrame(langkah);
        };
        raf = requestAnimationFrame(langkah);
      },
      // Dipicu 140px sebelum benar-benar terlihat: lompatan dari angka akhir
      // ke nol terjadi saat masih di luar layar, jadi yang terlihat pengunjung
      // hanya hitungan naiknya.
      { rootMargin: "0px 0px 140px 0px", threshold: 0 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, durasi]);

  return (
    <span ref={ref} className={className}>
      {compact ? formatCompact(tampil) : formatNumber(tampil)}
    </span>
  );
}
