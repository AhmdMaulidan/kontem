"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "./icon";
import { cn } from "./utils";

export type AccordionItem = { pertanyaan: string; jawaban: string };

/**
 * Akordeon pertanyaan (design.md bagian 6.7).
 *
 * Murni presentasional: isinya dioper lewat props, tidak ada query di sini.
 *
 * Hanya satu jawaban terbuka pada satu waktu — daftar dengan beberapa jawaban
 * panjang terbuka sekaligus memaksa pengunjung menggulir untuk sampai ke
 * pertanyaan berikutnya, padahal seksi ini justru dibaca dengan memindai.
 *
 * `perHalaman` membatasi jumlah item yang tampil sekaligus supaya seksinya
 * tidak memanjang; sisanya dicapai lewat tombol panah di bawah.
 */
export function Accordion({
  items,
  perHalaman = 4,
}: {
  items: AccordionItem[];
  perHalaman?: number;
}) {
  const [halaman, setHalaman] = useState(0);
  // Indeks dihitung terhadap seluruh daftar, bukan terhadap halamannya, supaya
  // pindah halaman tidak menyisakan jawaban terbuka di posisi yang sama.
  const [terbuka, setTerbuka] = useState(0);

  const jumlahHalaman = Math.ceil(items.length / perHalaman);
  const mulai = halaman * perHalaman;
  const tampil = items.slice(mulai, mulai + perHalaman);

  const pindah = (tujuan: number) => {
    setHalaman(tujuan);
    setTerbuka(tujuan * perHalaman);
  };

  return (
    <div>
      <div className="space-y-3">
        {tampil.map((item, i) => {
          const indeks = mulai + i;
          const dibuka = terbuka === indeks;

          return (
            <div
              key={item.pertanyaan}
              className="rounded-lg bg-surface p-3 shadow-card lg:p-4"
            >
              <button
                type="button"
                aria-expanded={dibuka}
                aria-controls={`faq-jawaban-${indeks}`}
                onClick={() => setTerbuka(dibuka ? -1 : indeks)}
                className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold lg:text-base"
              >
                <span className={cn(dibuka && "text-brand")}>
                  {item.pertanyaan}
                </span>
                <IconChevronRight
                  className={cn(
                    "h-5 w-5 flex-none text-brand-600 duration-200",
                    dibuka && "rotate-90",
                  )}
                />
              </button>

              {dibuka ? (
                <p
                  id={`faq-jawaban-${indeks}`}
                  className="mt-3 text-sm leading-relaxed text-body"
                >
                  {item.jawaban}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {jumlahHalaman > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Pertanyaan sebelumnya"
            disabled={halaman === 0}
            onClick={() => pindah(halaman - 1)}
            className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-600 transition-colors hover:bg-brand-200 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted"
          >
            <IconChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          </button>

          <span className="text-xs font-medium text-muted tabular-nums">
            {halaman + 1} / {jumlahHalaman}
          </span>

          <button
            type="button"
            aria-label="Pertanyaan berikutnya"
            disabled={halaman === jumlahHalaman - 1}
            onClick={() => pindah(halaman + 1)}
            className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted"
          >
            <IconChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
