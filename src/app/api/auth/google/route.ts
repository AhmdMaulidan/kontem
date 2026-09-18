import { NextResponse } from "next/server";
import { isGoogleConfigured, buildGoogleAuthUrl } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

/**
 * Inisiasi login Google — dipanggil dari tombol "Masuk dengan Google" di
 * halaman login & registrasi.
 *
 * Kalau kredensial belum diisi di `.env` (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI),
 * redirect balik ke /login dengan pesan jelas alih-alih 500 — tombolnya boleh
 * sudah tampil di UI sebelum Anda selesai setup Google Cloud Console.
 */
export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "google_belum_siap");
    return NextResponse.redirect(url);
  }

  const authUrl = await buildGoogleAuthUrl();
  return NextResponse.redirect(authUrl);
}
