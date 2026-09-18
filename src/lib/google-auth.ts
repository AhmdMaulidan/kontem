import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "./auth";

/**
 * Infrastruktur OAuth Google — disiapkan sebelum kredensial diisi.
 *
 * Tidak pakai library OAuth tambahan, konsisten dengan `lib/auth.ts` yang
 * sudah custom (cookie + JWT lewat `jose`), bukan NextAuth.
 *
 * `isGoogleConfigured()` jadi gerbang tunggal: rute API mengecek ini dulu
 * sebelum redirect ke Google, supaya tombol "Masuk dengan Google" tidak
 * error 500 kalau kredensial belum diisi di `.env` — cukup redirect balik
 * dengan pesan jelas.
 */

const PENDING_COOKIE = "kontem_google_pending";
const PENDING_MAX_AGE_SECONDS = 10 * 60; // 10 menit, cukup untuk isi form registrasi

export function getGoogleRedirectUri(requestUrl?: string | URL): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    if (requestUrl) {
      try {
        const reqOrigin = typeof requestUrl === "string" ? new URL(requestUrl).origin : requestUrl.origin;
        const envUri = new URL(process.env.GOOGLE_REDIRECT_URI);
        // Jika origin request cocok dengan env, gunakan env
        if (envUri.origin === reqOrigin) {
          return process.env.GOOGLE_REDIRECT_URI;
        }
        // Jika request berasal dari host yang berbeda (misal Vercel deployment), sesuaikan origin
        return `${reqOrigin}/api/auth/google/callback`;
      } catch {
        return process.env.GOOGLE_REDIRECT_URI;
      }
    }
    return process.env.GOOGLE_REDIRECT_URI;
  }

  if (requestUrl) {
    const origin = typeof requestUrl === "string" ? new URL(requestUrl).origin : requestUrl.origin;
    return `${origin}/api/auth/google/callback`;
  }

  return "http://localhost:3000/api/auth/google/callback";
}

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET,
  );
}

/**
 * `state` adalah JWT bertanda tangan pendek umur — bukan token acak yang
 * disimpan di cookie terpisah. Keabsahannya cukup diverifikasi dari tanda
 * tangannya sendiri saat callback, tanpa perlu state tersimpan di server.
 */
export async function buildGoogleAuthUrl(requestUrl?: string | URL) {
  const redirectUri = getGoogleRedirectUri(requestUrl);
  const state = await new SignJWT({ purpose: "google_oauth_state", redirectUri })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(authSecret());

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function verifyGoogleState(state: string) {
  try {
    const { payload } = await jwtVerify(state, authSecret());
    return payload.purpose === "google_oauth_state";
  } catch {
    return false;
  }
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
};

/** Tukar `code` dari Google jadi profil pengguna (email, nama, googleId). */
export async function exchangeGoogleCode(code: string, requestUrl?: string | URL): Promise<GoogleProfile> {
  const redirectUri = getGoogleRedirectUri(requestUrl);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error("Gagal menukar kode otorisasi dengan Google.");
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );
  if (!profileRes.ok) {
    throw new Error("Gagal mengambil profil akun Google.");
  }
  const profile = (await profileRes.json()) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  };

  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  };
}

/**
 * Simpan profil Google sementara (10 menit) di cookie httpOnly, dipakai saat
 * belum ada akun Kontem yang cocok — creator/vendor perlu isi sisa form
 * registrasi (kota, kategori usaha, dst) dulu sebelum akunnya benar-benar
 * dibuat. `googleId` sengaja TIDAK ikut dikirim ke client lewat query string
 * URL supaya tidak tersimpan di riwayat browser/referrer.
 */
export async function setPendingGoogleProfile(profile: GoogleProfile) {
  const token = await new SignJWT(profile)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MAX_AGE_SECONDS}s`)
    .sign(authSecret());

  const jar = await cookies();
  jar.set(PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MAX_AGE_SECONDS,
  });
}

export async function getPendingGoogleProfile(): Promise<GoogleProfile | null> {
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    return payload as unknown as GoogleProfile;
  } catch {
    return null;
  }
}

export async function clearPendingGoogleProfile() {
  const jar = await cookies();
  jar.delete(PENDING_COOKIE);
}
