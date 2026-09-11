/**
 * Bentuk dekoratif halaman depan.
 *
 * Tinggal satu bidang abstrak — pita gelombang — yang warnanya mengikuti token
 * sehingga ditulis sebagai SVG inline. Semua ilustrasi bergambar, termasuk
 * pita awan penutup hero, berupa berkas di `public/illustrations/`. Lihat
 * README di folder itu.
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
