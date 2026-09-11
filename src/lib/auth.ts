import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/enums";
import { db } from "./db";

const COOKIE_NAME = "kontem_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  role: Role;
  name: string;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET wajib diisi minimal 32 karakter.");
  }
  return new TextEncoder().encode(value);
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: payload.userId as string,
      role: payload.role as Role,
      name: payload.name as string,
    };
  } catch {
    // Token kedaluwarsa atau tanda tangannya tidak cocok.
    return null;
  }
}

/** Session + record user lengkap. Redirect ke login kalau belum masuk. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { creatorProfile: true, vendorProfile: true },
  });

  // User dihapus tapi cookie-nya masih ada.
  if (!user) {
    await destroySession();
    redirect("/login");
  }

  return user;
}

export async function requireRole<T extends Role>(role: T) {
  const user = await requireUser();
  if (user.role !== role) redirect(dashboardPath(user.role));
  return user;
}

export function dashboardPath(role: Role) {
  switch (role) {
    case Role.CREATOR:
      return "/creator";
    case Role.VENDOR:
      return "/vendor";
    case Role.ADMIN:
      return "/admin";
  }
}
