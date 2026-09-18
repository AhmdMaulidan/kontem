"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconSearch } from "./icon";
import { Input, Select } from "./form";
import { ENTRY_SIZE_OPTIONS } from "./pagination-utils";
import { cn } from "./utils";

export type ToolbarFilter = {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
};

export type ToolbarToggle = {
  name: string;
  label: string;
  /** Nilai yang ditulis ke URL saat tombolnya menyala. */
  value: string;
};

export type TableParams = Record<string, string | undefined>;

/**
 * Nilai penyaring hidup di URL, bukan di state komponen, supaya halamannya
 * tetap Server Component yang query sendiri — dan supaya hasil penyaringan
 * bisa disalin ke orang lain apa adanya.
 */
function buildHref(
  basePath: string,
  params: TableParams,
  patch: TableParams,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...patch })) {
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function TableToolbar({
  basePath,
  params,
  searchPlaceholder,
  filters = [],
  toggles = [],
  action,
}: {
  basePath: string;
  params: TableParams;
  /** Kotak cari tidak dirender kalau tidak diisi — mis. toolbar periode. */
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  toggles?: ToolbarToggle[];
  action?: React.ReactNode;
}) {
  const router = useRouter();
  const [term, setTerm] = useState(params.q ?? "");
  const terkirim = useRef(params.q ?? "");

  // Penyaringan berjalan saat mengetik — tanpa tombol "Cari", sama seperti
  // toolbar katalog. Jeda 300ms supaya tiap ketikan tidak jadi satu navigasi.
  useEffect(() => {
    if (term === terkirim.current) return;
    const timer = setTimeout(() => {
      terkirim.current = term;
      // Kembali ke halaman 1: hasil penyaringan baru membuat nomor halaman
      // lama menunjuk ke baris yang sudah tidak ada.
      router.replace(buildHref(basePath, params, { q: term, page: undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [term, basePath, params, router]);

  const pindah = (patch: TableParams) =>
    router.replace(buildHref(basePath, params, { ...patch, page: undefined }));

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
      {searchPlaceholder ? (
        <div className="relative col-span-2 w-full sm:col-span-1 sm:w-56 sm:shrink-0 xl:w-72">
          <IconSearch
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted sm:left-3.5"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9 text-xs py-2 sm:pl-10 sm:text-sm sm:py-2.5"
          />
        </div>
      ) : null}

      {filters.map((filter, idx) => (
        <div
          key={filter.name}
          className={cn(
            filters.length === 1
              ? "col-span-2 w-full"
              : filters.length === 3 && idx === 2
                ? "col-span-1 col-start-2 w-full"
                : "col-span-1 w-full",
            "sm:w-36 sm:shrink-0 xl:w-44",
          )}
        >
          <Select
            aria-label={filter.label}
            value={params[filter.name] ?? ""}
            onChange={(event) => pindah({ [filter.name]: event.target.value })}
            className="text-xs py-2 pr-8 sm:text-sm sm:py-2.5 sm:pr-10"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      ))}

      {toggles.map((toggle) => {
        const menyala = params[toggle.name] === toggle.value;
        return (
          <button
            key={toggle.name}
            type="button"
            aria-pressed={menyala}
            onClick={() =>
              pindah({ [toggle.name]: menyala ? undefined : toggle.value })
            }
            className={
              menyala
                ? "col-span-2 sm:col-span-1 rounded-full border border-brand-400 bg-brand-50 px-3 py-1.5 text-xs sm:px-4 sm:py-2.5 sm:text-sm font-medium text-brand-700"
                : "col-span-2 sm:col-span-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs sm:px-4 sm:py-2.5 sm:text-sm font-medium text-muted transition-colors hover:border-line-brand hover:text-brand-700"
            }
          >
            {toggle.label}
          </button>
        );
      })}

      {action ? (
        <div className="col-span-1 col-start-2 flex items-center justify-end sm:col-auto sm:col-start-auto sm:ml-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Daftar nomor halaman yang ditampilkan, dengan "..." untuk halaman yang
 * dilompati — supaya deretan tombol tidak meledak pada tabel berpuluh halaman.
 */
function pageList(page: number, lastPage: number): Array<number | "..."> {
  const items = new Set<number>([1, lastPage, page, page - 1, page + 1]);
  const sorted = [...items]
    .filter((n) => n >= 1 && n <= lastPage)
    .sort((a, b) => a - b);

  const result: Array<number | "..."> = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];
    if (prev !== undefined && current - prev > 1) result.push("...");
    result.push(current);
  }
  return result;
}

export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: TableParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const lastPage = Number.isFinite(pageSize)
    ? Math.max(1, Math.ceil(total / pageSize))
    : 1;
  const dari =
    total === 0
      ? 0
      : (page - 1) * (Number.isFinite(pageSize) ? pageSize : total) + 1;
  const sampai = Number.isFinite(pageSize)
    ? Math.min(page * pageSize, total)
    : total;

  const go = (target: number) =>
    router.replace(
      buildHref(basePath, params, {
        page: target === 1 ? undefined : String(target),
      }),
    );

  const arrow =
    "grid h-8 w-8 place-items-center rounded-full border border-line text-muted transition-colors hover:border-line-brand hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted";
  const numberBase =
    "grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs tabular transition-colors";

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="tabular text-xs text-muted">
        {`Menampilkan ${dari}-${sampai} dari ${total}`}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          className={arrow}
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        {pageList(page, lastPage).map((item, index) =>
          item === "..." ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-muted">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => go(item)}
              aria-current={item === page ? "page" : undefined}
              className={
                item === page
                  ? `${numberBase} border border-brand-400 bg-brand-50 font-medium text-brand-700`
                  : `${numberBase} border border-line text-muted hover:border-line-brand hover:text-brand-700`
              }
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= lastPage}
          aria-label="Halaman berikutnya"
          className={arrow}
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Selektor "Tampilkan N per halaman", biasanya duduk di sudut kanan atas tabel. */
export function PageSizeSelect({
  basePath,
  params,
  pageSize,
  paramName = "ukuran",
}: {
  basePath: string;
  params: TableParams;
  pageSize: number;
  paramName?: string;
}) {
  const router = useRouter();
  const value = Number.isFinite(pageSize) ? String(pageSize) : "all";

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span>Tampilkan</span>
      <select
        value={value}
        onChange={(event) =>
          router.replace(
            buildHref(basePath, params, {
              [paramName]: event.target.value,
              page: undefined,
            }),
          )
        }
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-foreground"
      >
        {ENTRY_SIZE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value="all">Semua</option>
      </select>
    </label>
  );
}
