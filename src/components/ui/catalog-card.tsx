import Image from "next/image";
import Link from "next/link";
import { formatIDR, formatIDRCompact } from "@/lib/format";
import { Badge } from "./badge";
import { FactChip } from "./fact-chip";
import { IconGift, IconPin } from "./icon";
import type { BadgeTone } from "@/lib/labels";

/**
 * Kartu katalog campaign — design.md bagian 6.5.
 *
 * Satu-satunya bentuk kartu untuk daftar campaign: halaman depan,
 * `/creator/campaigns`, dan daftar "Undang lagi" milik vendor memakai komponen
 * ini apa adanya, supaya creator melihat fakta yang sama persis di mana pun ia
 * menemukan campaign-nya.
 *
 * Semua angkanya dioper lewat props — komponen `ui/` tidak boleh melakukan
 * query sendiri (CONVENTIONS bagian 1).
 */
export function CatalogCard({
  href,
  judul,
  vendor,
  kota,
  kategori,
  kategoriTone,
  budgetPool,
  cpmRate,
  creatorBergabung,
  komplimen,
  sisaHari,
  foto,
  aksi = "Lihat detail",
}: {
  href: string;
  judul: string;
  vendor: string;
  kota: string;
  kategori: string;
  kategoriTone: BadgeTone;
  budgetPool: number;
  cpmRate: number;
  /** Berapa kreator yang sudah bergabung. Tidak ada kuota yang membatasinya. */
  creatorBergabung: number;
  komplimen?: string | null;
  sisaHari: number;
  foto?: string | null;
  aksi?: string;
}) {
  // Campaign yang sudah lewat tenggat tidak lagi menerima peserta. Dulu syarat
  // ini juga mencakup kuota slot yang penuh; kuotanya sudah dihapus — siapa pun
  // boleh ikut selama campaign masih berjalan.
  const tutup = sisaHari <= 0;

  return (
    <article className="relative flex flex-col rounded-lg bg-surface p-2.5 shadow-catalog transition-shadow hover:shadow-catalog-hover">
      {/* Pita sorotan selalu berisi tarif CPM, bukan kata-kata promosi.
          Dilepas kalau campaign sudah ditutup (design.md 6.5 butir 7). */}
      {tutup ? null : (
        <div className="absolute top-0 left-0 z-10 rounded-tl-[5px] rounded-r-full bg-gradient-to-r from-accent to-accent-400 px-2.5 py-1 lg:py-1.5">
          <span className="block text-[10px] font-semibold text-foreground lg:text-xs">
            CPM {formatIDRCompact(cpmRate)}
          </span>
        </div>
      )}

      {/* Badge kategori menempel di foto, bukan di bawahnya: kalau ditaruh
          sebagai baris tersendiri ia memakan tinggi kartu yang dibutuhkan
          tiga baris fakta. */}
      <div className="relative">
        {foto ? (
          <Image
            src={foto}
            alt=""
            width={640}
            height={360}
            className="aspect-video w-full rounded-md object-cover"
          />
        ) : (
          // Vendor yang belum mengunggah foto tempat dapat bidang polos —
          // lebih jujur daripada foto stok yang bukan milik outletnya.
          <div className="aspect-video w-full rounded-md bg-brand-50" />
        )}
        <div className="absolute bottom-1.5 left-1.5">
          <Badge tone={kategoriTone}>{kategori}</Badge>
        </div>
      </div>

      <h3 className="mt-2.5 truncate font-display text-sm font-semibold lg:text-base">
        {judul}
      </h3>
      <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted lg:text-[12px]">
        <IconPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        <span className="truncate">
          {vendor} · {kota}
        </span>
      </p>

      {/* Maksimal tiga baris fakta — sisanya isi halaman detail. */}
      <ul className="mt-2 flex flex-col gap-2">
        <li className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-muted lg:text-[12px]">Budget pool</p>
            <p className="tabular text-[11px] font-semibold text-brand-600 lg:text-[13px]">
              {formatIDR(budgetPool)}
            </p>
          </div>
          {/* Dulu chip ini berisi kuota slot. Kuota sudah dihapus — siapa pun
              boleh ikut — jadi yang ditampilkan sekarang berapa kreator yang
              SUDAH bergabung: itu info yang masih benar sekaligus jadi tanda
              campaign ini hidup. */}
          <FactChip>
            {creatorBergabung > 0
              ? `${creatorBergabung} kreator`
              : "Baru dibuka"}
          </FactChip>
        </li>
        <li className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-muted lg:text-[12px]">Tarif CPM</p>
            <p className="tabular text-[11px] font-semibold lg:text-[13px]">
              {formatIDR(cpmRate)}
              <span className="font-normal text-muted"> /1k views</span>
            </p>
          </div>
          <FactChip>{sisaHari > 0 ? `${sisaHari} hari` : "Berakhir"}</FactChip>
        </li>
        {komplimen ? (
          <li className="flex items-start gap-1.5">
            <IconGift
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600"
              strokeWidth={2}
            />
            <p className="truncate text-[10px] text-body lg:text-[12px]">
              {komplimen}
            </p>
          </li>
        ) : null}
      </ul>

      {/* mt-auto: tinggi kartu dalam satu baris grid tetap sama walau judul
          atau komplimennya berbeda panjang. */}
      <div className="mt-auto pt-3">
        {tutup ? (
          <span className="mt-2.5 block w-full cursor-not-allowed rounded-lg bg-surface-muted py-2 text-center text-[13px] font-medium text-muted lg:text-sm">
            Campaign berakhir
          </span>
        ) : (
          <Link
            href={href}
            className="mt-2.5 block w-full rounded-lg bg-brand py-2 text-center text-[13px] font-medium text-white transition-colors hover:bg-brand-600 lg:text-sm"
          >
            {aksi}
          </Link>
        )}
      </div>
    </article>
  );
}
