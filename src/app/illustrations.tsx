/**
 * Bentuk dekoratif halaman depan.
 *
 * Dua bidang abstrak — pita gelombang pendek dan pita panjang penghubung —
 * yang warnanya mengikuti token sehingga ditulis sebagai SVG inline. Semua
 * ilustrasi bergambar, termasuk pita awan penutup hero, berupa berkas di
 * `public/illustrations/`. Lihat README di folder itu.
 */

/**
 * Pita gelombang biru muda yang melintang di belakang seksi platform.
 * Dua lapis dengan opasitas berbeda supaya terbaca punya kedalaman tanpa
 * memakai gradien.
 */
export function WaveBand({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 520"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 150C260 60 520 220 760 300c220 72 420 30 680-50v120c-260 80-460 122-680 50C520 340 260 180 0 270z"
        fill="#BDE9F7"
      />
      <path
        d="M0 316C300 236 560 396 820 446c240 46 420 10 620-58v92H0z"
        fill="#BDE9F7"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Pita panjang yang menyambung dari bawah pita awan sampai seksi "Tayang di
 * mana saja", melewati deret kubah angka di antaranya.
 *
 * `preserveAspectRatio="none"` dipakai dengan sengaja: pita meregang mengikuti
 * tinggi seksi, dan koordinat viewBox-nya memetakan lurus ke persentase kotak
 * pembungkusnya (x/1440, y/1400) — berguna kalau suatu saat ada elemen yang
 * perlu ditempelkan tepat di tepi pita.
 */
export function RibbonBand({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 1400"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Satu lapis saja, warnanya pekat. Dua lapis dengan lebar berbeda
          (seperti WaveBand) terbaca sebagai pita di dalam pita — pada pita
          sependek itu efeknya kedalaman, pada pita sepanjang ini garis
          pucatnya mengikuti sepanjang jalur dan terlihat seperti warna dobel.

          Pita masuk dari TEPI KIRI layar, bukan dari balik pita awan. Bidang
          bawah berkas awan itu putih polos, jadi pita yang disembunyikan di
          baliknya selalu muncul terpotong garis lurus di tepi gambar —
          justru terbaca putus. Masuk dari luar layar tidak punya ujung yang
          terlihat sama sekali. */}
      <path
        d="M-80 105 C 30 120, 120 290, 255 395 C 420 520, 610 510, 770 515 C 1030 536, 1200 570, 1260 690 C 1320 810, 1100 910, 815 940 C 575 966, 350 1020, 370 1130 C 390 1240, 900 1270, 1500 1190"
        fill="none"
        // Warnanya disamakan dengan panel biru hero, lewat token — bukan hex
        // hardcode (CONVENTIONS bagian 7).
        stroke="var(--brand-300)"
        strokeWidth="78"
      />
    </svg>
  );
}
