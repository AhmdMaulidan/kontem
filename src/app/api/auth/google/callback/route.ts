import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, dashboardPath } from "@/lib/auth";
import {
  isGoogleConfigured,
  verifyGoogleState,
  exchangeGoogleCode,
  setPendingGoogleProfile,
} from "@/lib/google-auth";

export const dynamic = "force-dynamic";

function keLogin(request: Request, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/**
 * Callback OAuth Google. Tiga kemungkinan hasil:
 * 1. `googleId` sudah cocok dengan akun yang ada -> langsung login.
 * 2. Email cocok tapi akun itu belum pernah pakai Google -> akun ditautkan
 *    (googleId disimpan), lalu login seperti biasa.
 * 3. Belum ada akun sama sekali -> profil disimpan sementara di cookie,
 *    diarahkan ke /register untuk melengkapi sisa data (role, kota, dst)
 *    sebelum akun benar-benar dibuat.
 */
export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return keLogin(request, "google_belum_siap");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) {
    return keLogin(request, "google_dibatalkan");
  }
  if (!code || !state || !(await verifyGoogleState(state))) {
    return keLogin(request, "google_state_tidak_valid");
  }

  try {
    const profile = await exchangeGoogleCode(code);
    const email = profile.email.toLowerCase();

    const existing = await db.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email }] },
    });

    if (existing) {
      if (!existing.googleId) {
        await db.user.update({
          where: { id: existing.id },
          data: { googleId: profile.googleId },
        });
      }
      await createSession({
        userId: existing.id,
        role: existing.role,
        name: existing.name,
      });
      return NextResponse.redirect(new URL(dashboardPath(existing.role), request.url));
    }

    // Belum ada akun — arahkan ke registrasi untuk melengkapi role & profil.
    await setPendingGoogleProfile(profile);
    return NextResponse.redirect(new URL("/register?method=google", request.url));
  } catch (error) {
    console.error("[GoogleCallback Error]", error);
    return keLogin(request, "google_gagal");
  }
}
