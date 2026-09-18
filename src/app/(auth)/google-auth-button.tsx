import { ButtonLink, LogoGoogle } from "@/components/ui";

/**
 * Tombol login/daftar dengan Google, dipakai di halaman Login & Registrasi.
 *
 * Mengarah ke rute OAuth (`/api/auth/google`) yang mengecek sendiri apakah
 * kredensial Google sudah diisi di `.env` — kalau belum, rute itu yang
 * mengarahkan balik dengan pesan error, bukan tombol ini yang disembunyikan.
 * Tombolnya sengaja tetap tampil supaya bentuk akhirnya sudah bisa dilihat
 * sebelum kredensial diisi.
 */
export function GoogleAuthButton({ label }: { label: string }) {
  return (
    <ButtonLink href="/api/auth/google" variant="secondary" shape="block">
      <LogoGoogle className="h-4.5 w-4.5" />
      {label}
    </ButtonLink>
  );
}
