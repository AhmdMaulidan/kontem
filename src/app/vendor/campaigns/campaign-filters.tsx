"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, Select } from "@/components/ui";

const STATUS_OPTIONS = [
  { label: "Semua status", value: "" },
  { label: "Berjalan", value: "ACTIVE" },
  { label: "Menunggu Approval", value: "PENDING_REVIEW" },
  { label: "Draft", value: "DRAFT" },
  { label: "Selesai", value: "SETTLED" },
  { label: "Ditolak", value: "REJECTED" },
  { label: "Dibatalkan", value: "CANCELLED" },
];

/**
 * Toolbar filter halaman "Semua campaign" — dirender sejajar dengan judul
 * halaman (dioper sebagai `action` ke header). Client component karena butuh
 * debounce search dan navigasi reaktif pada status dropdown.
 *
 * `defaultQ` dan `defaultStatus` dari server (URL search params) sehingga
 * tidak perlu `useSearchParams` dan tidak butuh Suspense boundary.
 */
export function CampaignFilters({
  defaultQ = "",
  defaultStatus = "",
}: {
  defaultQ?: string;
  defaultStatus?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQ);
  const [status, setStatus] = useState(defaultStatus);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (nextQ: string, nextStatus: string) => {
      const params = new URLSearchParams();
      if (nextQ) params.set("q", nextQ);
      if (nextStatus) params.set("status", nextStatus);
      const qs = params.toString();
      router.push(`/vendor/campaigns${qs ? `?${qs}` : ""}`);
    },
    [router],
  );

  const handleSearch = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(value, status), 400);
  };

  const handleStatus = (value: string) => {
    setStatus(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(q, value);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search — dipendekkan lewat rasio flex di ponsel supaya dropdown
          status kebagian ruang cukup untuk menampilkan tulisannya utuh. */}
      <div className="relative min-w-0 flex-[3] sm:flex-1">
        <IconSearch
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Cari campaign..."
          className="w-full rounded-xl border border-line bg-surface py-2.5 pr-2 pl-8 text-sm text-body outline-none transition-colors placeholder:text-muted/70 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 sm:pr-3 sm:pl-9"
        />
      </div>

      {/* Status dropdown — flex-[2] di ponsel supaya labelnya (mis. "Semua
          status") tidak terpotong; sm ke atas kembali ke lebar tetap yang
          lebih lega. Padding kanan/kiri select ikut dirapatkan di ponsel. */}
      <div className="min-w-0 flex-[2] sm:w-44 sm:flex-none">
        <Select
          value={status}
          onChange={(e) => handleStatus(e.target.value)}
          className="pr-7 pl-2.5 text-xs sm:pr-10 sm:pl-4 sm:text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
