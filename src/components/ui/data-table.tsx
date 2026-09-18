import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * Tabel kerja admin — satu pola untuk seluruh halaman `/admin/*`.
 *
 * Judul di kiri, ringkasan antrean di kanan: admin perlu tahu beban kerjanya
 * sebelum membaca isi tabel. Toolbar cari/filter duduk di antara header dan
 * tabel, kaki tabel memuat pagination.
 */
export function DataTable({
  title,
  summary,
  action,
  toolbar,
  footer,
  children,
  tableClassName,
}: {
  title: string;
  summary?: ReactNode;
  action?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  tableClassName?: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <h2 className="font-display text-base font-semibold sm:text-lg">{title}</h2>
        <div className="flex items-center gap-3">
          {summary ? <p className="text-xs text-muted sm:text-sm">{summary}</p> : null}
          {action}
        </div>
      </div>

      {toolbar ? <div className="px-4 pt-3 sm:px-5 sm:pt-4">{toolbar}</div> : null}

      {/* Isi halaman dibatasi max-w-6xl oleh rangka dasbor, jadi tabel
          berkolom banyak digulung di dalam pembungkusnya sendiri — bukan
          dibiarkan melar mengikuti lebar layar. */}
      <div className="mt-3 sm:mt-4 overflow-x-auto">
        <table className={cn("w-full text-sm", tableClassName ?? "min-w-[52rem]")}>
          {children}
        </table>
      </div>

      {footer ? (
        <div className="border-t border-line px-4 py-3 sm:px-5">{footer}</div>
      ) : null}
    </section>
  );
}

/**
 * Nomor urut menerus lintas halaman — halaman kedua mulai dari 11, bukan
 * dari 1. Admin menyebut baris lewat telepon saat konfirmasi vendor, dan
 * nomor yang mengulang tiap halaman membuat rujukan itu ambigu.
 */
export function rowNumber(index: number, page: number, pageSize: number) {
  if (!Number.isFinite(pageSize)) return index + 1;
  return (page - 1) * pageSize + index + 1;
}

/** Baris keterangan di kaki tabel, mis. penjelasan tanda anomali. */
export function TableCaptionRow({
  colSpan,
  children,
  tone = "muted",
}: {
  colSpan: number;
  children: ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={cn(
          "px-3 py-2.5 text-xs",
          tone === "danger" ? "text-danger" : "text-muted",
        )}
      >
        {children}
      </td>
    </tr>
  );
}

/** Sel yang membungkus EmptyState saat tabel tidak punya baris sama sekali. */
export function TableEmptyRow({
  colSpan,
  title,
  description,
  children,
}: {
  colSpan: number;
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6">
        {children ?? (
          <div className="rounded-2xl border border-dashed border-line-brand bg-brand-soft/40 px-6 py-10 text-center">
            <p className="font-display font-semibold text-foreground">
              {title}
            </p>
            {description ? (
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                {description}
              </p>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}
