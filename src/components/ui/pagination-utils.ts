/**
 * Utilitas pagination murni (tanpa hook React), dipisah dari toolbar.tsx
 * supaya bisa dipanggil langsung di Server Component. File yang bertanda
 * "use client" membuat SEMUA ekspornya jadi client reference — memanggilnya
 * langsung (bukan me-render-nya sebagai komponen) dari Server Component akan
 * error "Attempted to call ... from the server ...".
 */

/** Pilihan baku untuk selektor "Tampilkan N per halaman". */
export const ENTRY_SIZE_OPTIONS = [10, 50, 100] as const;

/**
 * Membaca parameter `ukuran` dari URL menjadi jumlah baris per halaman.
 * `"all"` berarti tanpa batas (semua baris ditampilkan sekaligus).
 */
export function resolvePageSize(
  value: string | undefined,
  defaultSize: number,
): number {
  if (value === "all") return Infinity;
  const n = Number(value);
  return ENTRY_SIZE_OPTIONS.includes(n as (typeof ENTRY_SIZE_OPTIONS)[number])
    ? n
    : defaultSize;
}

/** Argumen `skip`/`take` Prisma untuk suatu halaman — kosong kalau `pageSize` tak terbatas. */
export function paginationArgs(
  page: number,
  pageSize: number,
): { skip?: number; take?: number } {
  if (!Number.isFinite(pageSize)) return {};
  return { skip: (page - 1) * pageSize, take: pageSize };
}
