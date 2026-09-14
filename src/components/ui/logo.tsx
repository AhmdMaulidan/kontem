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
 * ikut rasio 3,18:1 bawaan berkasnya.
 *
 * `viewBox` kedua berkas sengaja dirapatkan ke kotak tinta lalu disamakan
 * rasionya. Aslinya logo biru berkanvas 4:3 dengan ~60% tingginya berupa
 * ruang kosong, sedangkan logo putih 2,5:1 — pada `h-9` yang sama logo biru
 * jadi tampak jauh lebih kecil. Karena keduanya kini serasio, keduanya bisa
 * saling menggantikan tanpa mengubah tata letak di sekitarnya.
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
      width={1272}
      height={400}
      priority={priority}
      className={cn("w-auto", className)}
    />
  );
}
