"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, Select } from "@/components/ui";
import { categoryLabel } from "@/lib/labels";

/**
 * Toolbar filter halaman "Cari campaign" — search, kota, dan kategori
 * langsung menyaring hasil tanpa tombol submit terpisah. Client component
 * karena butuh debounce search dan navigasi reaktif pada dua dropdown.
 *
 * Nilai awal dioper dari server (URL search params) supaya tidak perlu
 * `useSearchParams` dan tidak butuh Suspense boundary.
 */
export function CampaignFilters({
  defaultQ = "",
  defaultKota = "",
  defaultKategori = "",
  kotaTersedia,
}: {
  defaultQ?: string;
  defaultKota?: string;
  defaultKategori?: string;
  kotaTersedia: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQ);
  const [kota, setKota] = useState(defaultKota);
  const [kategori, setKategori] = useState(defaultKategori);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (nextQ: string, nextKota: string, nextKategori: string) => {
      const params = new URLSearchParams();
      if (nextQ) params.set("q", nextQ);
      if (nextKota) params.set("kota", nextKota);
      if (nextKategori) params.set("kategori", nextKategori);
      const qs = params.toString();
      router.push(`/creator/campaigns${qs ? `?${qs}` : ""}`);
    },
    [router],
  );

  const handleSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(value, kota, kategori), 400);
  };

  const handleKota = (value: string) => {
    setKota(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(q, value, kategori);
  };

  const handleKategori = (value: string) => {
    setKategori(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(q, kota, value);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Cari campaign"
          className="w-full rounded-xl border border-line bg-surface py-2.5 pl-11 pr-5 text-sm text-body outline-none transition-colors placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
      </div>

      <div className="sm:w-44">
        <Select value={kota} onChange={(e) => handleKota(e.target.value)}>
          <option value="">Semua kota</option>
          {kotaTersedia.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>

      <div className="sm:w-48">
        <Select value={kategori} onChange={(e) => handleKategori(e.target.value)}>
          <option value="">Semua kategori</option>
          {Object.entries(categoryLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
