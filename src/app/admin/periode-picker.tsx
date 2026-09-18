"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

const PILIHAN = [
  { value: "30", label: "30 hari terakhir" },
  { value: "90", label: "90 hari terakhir" },
  { value: "365", label: "12 bulan terakhir" },
];

/** Pemilih periode untuk kartu metrik ringkasan dan analitik. */
export function PeriodePicker({
  value,
  basePath = "/admin",
  className,
}: {
  value: string;
  basePath?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Select
      aria-label="Periode"
      value={value}
      onChange={(event) =>
        router.replace(
          event.target.value === "30"
            ? basePath
            : `${basePath}?periode=${event.target.value}`,
        )
      }
      className={className ?? "w-auto min-w-[11rem]"}
    >
      {PILIHAN.map((pilihan) => (
        <option key={pilihan.value} value={pilihan.value}>
          {pilihan.label}
        </option>
      ))}
    </Select>
  );
}
