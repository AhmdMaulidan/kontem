import { buttonClass, LogoGoogle } from "@/components/ui";

/**
 * Tombol login/daftar dengan Google, dipakai di halaman Login & Registrasi.
 *
 * Mengarah ke rute OAuth (`/api/auth/google`) yang mengecek sendiri apakah
 * kredensial Google sudah diisi di `.env` — kalau belum, rute itu yang
 * mengarahkan balik dengan pesan error, bukan tombol ini yang disembunyikan.
 *
 * PENTING: Harus memakai tag <a> native (bukan Next.js <Link>) supaya browser
 * melakukan navigasi HTTP penuh, bukan AJAX fetch (RSC prefetch) yang dapat
 * memicu penolakan CORS dari accounts.google.com.
 */
export function GoogleAuthButton({ label }: { label: string }) {
  return (
    <a
      href="/api/auth/google"
      className={buttonClass("secondary", "md", "block")}
    >
      <LogoGoogle className="h-4.5 w-4.5" />
      {label}
    </a>
  );
}
