import { cn } from "./utils";

/**
 * Bilah slot kartu katalog — design.md bagian 6.5.
 *
 * Berbeda dari <ProgressBar> milik dasbor: tulisannya ada *di dalam* bilah,
 * dan bilahnya menunjukkan slot yang sudah terpakai (mengikuti arah perjalanan
 * campaign) meski tulisannya menyebut sisa slot, karena itu yang dibutuhkan
 * creator saat memilih.
 */
export function SlotBar({
  terpakai,
  total,
  closed,
}: {
  terpakai: number;
  total: number;
  closed?: boolean;
}) {
  const sisa = Math.max(0, total - terpakai);
  const percent = total > 0 ? Math.min(100, (terpakai / total) * 100) : 0;
  const label = sisa > 0 ? `Sisa ${sisa} dari ${total} slot` : "Slot penuh";

  // Di bawah 45% bagian terisi terlalu sempit untuk memuat tulisannya, jadi
  // tulisan dipindah ke tengah track supaya tidak terpotong.
  const labelDiDalam = percent >= 45;

  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-surface-muted">
      <div
        className={cn(
          "flex h-4 items-center justify-center rounded-full transition-all",
          closed ? "bg-muted" : "bg-brand",
        )}
        style={{ width: `${percent}%` }}
      >
        {labelDiDalam ? (
          <span className="px-2 text-[10px] font-bold whitespace-nowrap text-white">
            {label}
          </span>
        ) : null}
      </div>

      {labelDiDalam ? null : (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
