import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

/**
 * Rangka halaman Login & Registrasi — dua kolom di desktop (panel brand +
 * ilustrasi di kiri, form di kanan), satu kolom polos di mobile.
 *
 * Panel kiri sengaja disembunyikan di bawah `lg`, bukan ditumpuk di atas
 * form: pada layar sempit, panel setinggi 40-50vh sebelum form membuat
 * pengunjung harus scroll dulu sebelum mulai mengisi — sama seperti alasan
 * hero landing page tidak dipakai ulang mentah-mentah di sini.
 *
 * Panel kiri dipatok `h-screen` + `sticky top-0`, BUKAN tinggi alami (yang
 * otomatis meregang mengikuti kolom kanan karena flex row menyamakan tinggi
 * kedua kolom). Tanpa ini, gambar yang diposisikan `justify-between` di
 * dalamnya ikut bergeser setiap kali form kanan berubah panjang — mis. saat
 * pilihan Creator/Vendor diganti (form Vendor jauh lebih panjang). Dengan
 * tinggi tetap sepanjang viewport, posisi gambar konstan apa pun tinggi form.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <div className="relative hidden overflow-hidden bg-brand-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[42%] lg:shrink-0 lg:flex-col lg:justify-between lg:px-10 lg:py-10">
        <Link href="/" className="flex w-fit items-center">
          <Logo variant="putih" className="h-8" priority />
        </Link>

        <div className="mx-auto w-full max-w-sm text-center">
          <Image
            src="/illustrations/image-hero.svg"
            alt=""
            width={1500}
            height={1000}
            priority
            className="mx-auto h-auto w-full"
          />
          <p className="mt-6 font-display text-xl font-bold text-white">
            Promosi lokasi yang transparan dan terukur
          </p>
          <p className="mt-2 text-sm text-foreground/90">
            Dana aman di escrow, dibayar sesuai views yang benar-benar
            tercipta.
          </p>
        </div>

        {/* Spacer kosong supaya logo tetap di atas dan blok teks tetap di
            tengah walau tanpa elemen ketiga di bawah (justify-between). */}
        <div aria-hidden />
      </div>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-line bg-surface lg:hidden">
          <div className="px-4 py-3.5">
            <Link href="/" className="flex w-fit items-center">
              <Logo className="h-8" priority />
            </Link>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-8 sm:py-12">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
