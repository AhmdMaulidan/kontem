"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  dashboardPath,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { generateSocialVerifyToken } from "@/domain/codes";

export type AuthState = { error?: string };

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  // Pesan yang sama untuk email tidak ada maupun password salah, supaya
  // halaman login tidak bisa dipakai menebak email yang terdaftar.
  const invalid = { error: "Email atau password salah." };
  if (!user?.passwordHash) return invalid;

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid;

  await createSession({ userId: user.id, role: user.role, name: user.name });
  redirect(dashboardPath(user.role));
}

const baseRegister = {
  name: z.string().min(2, "Nama minimal 2 karakter."),
  email: z.string().email("Format email tidak valid."),
  phone: z.string().min(8, "Nomor HP tidak valid."),
  password: z.string().min(8, "Password minimal 8 karakter."),
};

const creatorSchema = z.object({
  ...baseRegister,
  role: z.literal("CREATOR"),
  city: z.string().min(2, "Kota domisili wajib diisi."),
  province: z.string().min(2, "Provinsi wajib diisi."),
  socialPlatform: z.enum(["TIKTOK", "INSTAGRAM", "YOUTUBE"]),
  socialHandle: z.string().min(2, "Username medsos wajib diisi."),
});

const vendorSchema = z.object({
  ...baseRegister,
  role: z.literal("VENDOR"),
  businessName: z.string().min(2, "Nama usaha wajib diisi."),
  category: z.enum([
    "KULINER",
    "WISATA_ALAM",
    "WISATA_BUATAN",
    "AKOMODASI",
    "LAINNYA",
  ]),
  address: z.string().min(5, "Alamat wajib diisi."),
  city: z.string().min(2, "Kota wajib diisi."),
  province: z.string().min(2, "Provinsi wajib diisi."),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  picName: z.string().min(2, "Nama PIC wajib diisi."),
  picPhone: z.string().min(8, "Nomor PIC tidak valid."),
});

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const role = formData.get("role");
  const raw = Object.fromEntries(formData.entries());

  const parsed =
    role === "VENDOR"
      ? vendorSchema.safeParse(raw)
      : creatorSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "Email sudah terdaftar." };

  const passwordHash = await hashPassword(data.password);

  if (data.role === "VENDOR") {
    // Vendor menunggu verifikasi manual admin sebelum bisa bikin campaign.
    const user = await db.user.create({
      data: {
        role: "VENDOR",
        email,
        name: data.name,
        phone: data.phone,
        passwordHash,
        status: "PENDING",
        vendorProfile: {
          create: {
            businessName: data.businessName,
            category: data.category,
            address: data.address,
            city: data.city,
            province: data.province,
            latitude: data.latitude,
            longitude: data.longitude,
            photos: [],
            picName: data.picName,
            picPhone: data.picPhone,
          },
        },
      },
    });
    await createSession({ userId: user.id, role: user.role, name: user.name });
    redirect("/vendor");
  }

  const handle = data.socialHandle.replace(/^@/, "");
  const duplicateSocial = await db.socialAccount.findUnique({
    where: {
      platform_handle: { platform: data.socialPlatform, handle },
    },
  });
  if (duplicateSocial) {
    return { error: "Akun media sosial ini sudah ditautkan ke user lain." };
  }

  const profileUrl =
    data.socialPlatform === "YOUTUBE"
      ? `https://youtube.com/@${handle}`
      : data.socialPlatform === "INSTAGRAM"
        ? `https://instagram.com/${handle}`
        : `https://tiktok.com/@${handle}`;

  const user = await db.user.create({
    data: {
      role: "CREATOR",
      email,
      name: data.name,
      phone: data.phone,
      passwordHash,
      // Tidak ada minimum followers — creator langsung bisa browse campaign.
      status: "VERIFIED",
      creatorProfile: {
        create: { city: data.city, province: data.province },
      },
      socialAccounts: {
        create: {
          platform: data.socialPlatform,
          handle,
          profileUrl,
          verifyToken: generateSocialVerifyToken(),
        },
      },
    },
  });

  await createSession({ userId: user.id, role: user.role, name: user.name });
  redirect("/creator");
}
