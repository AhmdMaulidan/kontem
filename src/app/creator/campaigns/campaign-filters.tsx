"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Card, Input, Select } from "@/components/ui";
import { categoryLabel } from "@/lib/labels";

/** Harus sama persis dengan sentinel di page.tsx. */
const SEMUA_KOTA = "all";

/**
 * Toolbar pencarian campaign creator — menyaring langsung saat mengetik atau
 * memilih, tanpa tombol "Filter" terpisah (design.md bagian 5.2 & 6.6).
 *
 * Nilai penyaring tetap hidup di URL (bukan state lokal) supaya halamannya
 * tetap Server Component yang query sendiri dan hasilnya bisa disalin ke
 * orang lain apa adanya.
 */
export function CampaignFilters({
  kota,
  kategori,
  q,
  kotaTersedia,
}: {
  /** String kosong berarti "semua kota" — sudah diresolusi oleh page.tsx. */
  kota: string;
  kategori: string;
  q: string;
  kotaTersedia: string[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState(q);
  const terkirim = useRef(q);

  // Penyaringan teks berjalan saat mengetik, dengan jeda 300ms supaya tiap
  // ketikan tidak jadi satu navigasi terpisah.
  useEffect(() => {
    if (term === terkirim.current) return;
    const timer = setTimeout(() => {
      terkirim.current = term;
      pindah({ q: term });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  function pindah(patch: { kota?: string; kategori?: string; q?: string }) {
    const next = { kota, kategori, q, ...patch };
    const params = new URLSearchParams();
    // Kota SELALU ditulis eksplisit (memakai sentinel SEMUA_KOTA kalau
    // kosong) — kalau tidak ditulis sama sekali, page.tsx akan jatuh balik
    // ke kota domisili creator dan filter "Semua kota" terasa tidak berfungsi.
    params.set("kota", next.kota || SEMUA_KOTA);
    if (next.kategori) params.set("kategori", next.kategori);
    if (next.q) params.set("q", next.q);
    router.replace(`/creator/campaigns?${params.toString()}`);
  }

  return (
    <Card className="mb-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          placeholder="Cari nama campaign..."
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
        <Select
          value={kota || SEMUA_KOTA}
          onChange={(event) => pindah({ kota: event.target.value })}
        >
          <option value={SEMUA_KOTA}>Semua kota</option>
          {kotaTersedia.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select
          value={kategori}
          onChange={(event) => pindah({ kategori: event.target.value })}
        >
          <option value="">Semua kategori</option>
          {Object.entries(categoryLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </Card>
  );
}
