import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Seluruh ilustrasi Kontem berformat SVG dan berasal dari `public/` —
    // milik sendiri, bukan unggahan pengguna. Tanpa izin ini `next/image`
    // menolak semuanya dengan 400 dan halaman tampil tanpa gambar.
    dangerouslyAllowSVG: true,
    // Pagar pengaman yang disarankan Next untuk menyalakan opsi di atas:
    // SVG disajikan tanpa hak menjalankan skrip, jadi berkas SVG jahat
    // (kalau suatu saat ada yang lolos masuk) tidak bisa berbuat apa-apa.
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
