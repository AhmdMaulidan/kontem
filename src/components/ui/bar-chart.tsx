import { cn } from "./utils";

/**
 * Grafik batang sederhana — `div` bertinggi persentase, tanpa pustaka grafik.
 *
 * Satu-satunya grafik di produk ini adalah batang sederhana (GMV per bulan,
 * tren views sebuah submission); menambah dependensi untuk itu tidak sebanding.
 */
export function BarChart({
  data,
  formatValue,
  tone = "brand",
  height = "h-40",
}: {
  data: Array<{ label: string; value: number; danger?: boolean }>;
  formatValue: (value: number) => string;
  tone?: "brand" | "accent";
  height?: string;
}) {
  const tertinggi = Math.max(1, ...data.map((item) => item.value));

  return (
    <div>
      <div className={cn("flex items-end gap-2", height)}>
        {data.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="flex h-full flex-1 flex-col justify-end gap-1.5"
          >
            <p className="tabular text-center text-[11px] text-muted">
              {formatValue(item.value)}
            </p>
            <div
              className={cn(
                "w-full rounded-t-md",
                item.danger
                  ? "bg-danger"
                  : tone === "accent"
                    ? "bg-accent"
                    : "bg-brand",
              )}
              // Tinggi minimum 2px supaya bulan bernilai nol tetap punya
              // pijakan yang terlihat, bukan menghilang dari deretnya.
              style={{
                height: `max(2px, ${(item.value / tertinggi) * 100}%)`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2">
        {data.map((item, index) => (
          <p
            key={`${item.label}-label-${index}`}
            className="flex-1 text-center text-[11px] text-muted"
          >
            {item.label}
          </p>
        ))}
      </div>
    </div>
  );
}
