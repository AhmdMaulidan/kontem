import Image from "next/image";
import { cn } from "./utils";

/**
 * Logo Kontem.
 *
 * Dua berkas, satu bentuk: `biru` untuk latar terang (putih, abu, biru pucat)
 * dan `putih` untuk latar pekat (brand-500/600, panel hero, footer arang).
 * Varian dipilih lewat prop, bukan lewat filter CSS, karena lambangnya bukan
 * siluet satu warna — ada gradasi dan awan di dalamnya yang akan rusak kalau
 * dibalik warnanya secara otomatis.
 *
 * Tingginya diatur pemakai lewat `className` (`h-9`, `h-10`, …); lebarnya
 * ikut rasio 1414:514 bawaan berkasnya.
 */
const SUMBER = {
  biru: "/illustrations/logo-biru.svg",
  putih: "/illustrations/logo-putih.svg",
} as const;

export function Logo({
  variant = "biru",
  className,
  priority,
}: {
  variant?: keyof typeof SUMBER;
  className?: string;
  /** Nyalakan untuk logo yang tampil tanpa digulir, mis. nav halaman depan. */
  priority?: boolean;
}) {
  return (
    <Image
      src={SUMBER[variant]}
      alt="Kontem"
      width={1414}
      height={514}
      priority={priority}
      className={cn("w-auto", className)}
    />
  );
}
