"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useActionState } from "react";
import { registerAction, type AuthState } from "../actions";
import {
  Callout,
  Card,
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
  cn,
} from "@/components/ui";
import { categoryLabel } from "@/lib/labels";

type Role = "CREATOR" | "VENDOR";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = use(searchParams);
  const [role, setRole] = useState<Role>(
    params.role === "vendor" ? "VENDOR" : "CREATOR",
  );
  const [state, formAction] = useActionState<AuthState, FormData>(
    registerAction,
    {},
  );

  return (
    <Card float className="p-7">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Daftar akun
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-brand-600">
          Masuk
        </Link>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-full bg-surface-muted p-1.5">
        {(["CREATOR", "VENDOR"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRole(option)}
            className={cn(
              "rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
              role === option
                ? "bg-surface text-brand-700 shadow-card"
                : "text-muted hover:text-foreground",
            )}
          >
            {option === "CREATOR" ? "Saya Creator" : "Saya Vendor"}
          </button>
        ))}
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="role" value={role} />
        <FormError message={state.error} />

        <Field label={role === "VENDOR" ? "Nama PIC / pemilik" : "Nama lengkap"}>
          <Input name="name" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Nomor HP">
            <Input name="phone" required placeholder="08xxxxxxxxxx" />
          </Field>
        </div>
        <Field label="Password" hint="Minimal 8 karakter.">
          <Input name="password" type="password" required minLength={8} />
        </Field>

        {role === "CREATOR" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Kota/kabupaten domisili"
                hint="Dipakai mencocokkan campaign terdekat."
              >
                <Input name="city" required placeholder="Malang" />
              </Field>
              <Field label="Provinsi">
                <Input name="province" required placeholder="Jawa Timur" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Platform">
                <Select name="socialPlatform" defaultValue="TIKTOK">
                  <option value="TIKTOK">TikTok</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="YOUTUBE">YouTube</option>
                </Select>
              </Field>
              <Field label="Username" hint="Tanpa tanda @.">
                <Input name="socialHandle" required placeholder="ditamakan" />
              </Field>
            </div>
            <Callout tone="info">
              Tidak ada minimum followers. Setelah daftar, kamu akan diminta
              menempel kode verifikasi di bio untuk membuktikan kepemilikan akun.
            </Callout>
          </>
        ) : (
          <>
            <Field label="Nama usaha">
              <Input name="businessName" required placeholder="Kopi Senja Malang" />
            </Field>
            <Field label="Kategori usaha">
              <Select name="category" defaultValue="KULINER">
                {Object.entries(categoryLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Alamat lengkap">
              <Input name="address" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kota/kabupaten">
                <Input name="city" required />
              </Field>
              <Field label="Provinsi">
                <Input name="province" required />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" hint="Ambil dari Google Maps.">
                <Input name="latitude" required placeholder="-7.9497" />
              </Field>
              <Field label="Longitude">
                <Input name="longitude" required placeholder="112.6156" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama PIC">
                <Input name="picName" required />
              </Field>
              <Field label="Nomor PIC" hint="Dihubungi admin saat verifikasi.">
                <Input name="picPhone" required />
              </Field>
            </div>
            <Callout tone="warning">
              Akun vendor diverifikasi manual oleh admin — pengecekan Google Maps,
              foto lokasi, dan konfirmasi telepon. Campaign baru bisa dibuat
              setelah verifikasi lolos.
            </Callout>
          </>
        )}

        <SubmitButton className="w-full" pendingLabel="Memproses...">
          {role === "VENDOR"
            ? "Daftar & ajukan verifikasi"
            : "Buat akun creator"}
        </SubmitButton>
      </form>
    </Card>
  );
}
