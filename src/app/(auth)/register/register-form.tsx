"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { registerAction, type AuthState } from "../actions";
import {
  Callout,
  Card,
  Field,
  FormError,
  Input,
  LogoInstagram,
  LogoTikTok,
  LogoYouTube,
  Select,
  SubmitButton,
  cn,
} from "@/components/ui";
import { categoryLabel } from "@/lib/labels";
import { GoogleAuthButton } from "../google-auth-button";

type Role = "CREATOR" | "VENDOR";
type SocialPlatform = "TIKTOK" | "INSTAGRAM" | "YOUTUBE";

const PLATFORM_OPTIONS: { value: SocialPlatform; label: string; Logo: typeof LogoTikTok }[] = [
  { value: "TIKTOK", label: "TikTok", Logo: LogoTikTok },
  { value: "INSTAGRAM", label: "Instagram", Logo: LogoInstagram },
  { value: "YOUTUBE", label: "YouTube", Logo: LogoYouTube },
];

export function RegisterForm({
  defaultRole,
  googlePrefill,
}: {
  defaultRole: Role;
  googlePrefill: { email: string; name: string } | null;
}) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [state, formAction] = useActionState<AuthState, FormData>(
    registerAction,
    {},
  );

  // Creator boleh menautkan lebih dari satu platform sekaligus — begitu
  // dicentang, muncul input username khusus platform itu. Dikirim ke server
  // sebagai satu field JSON tersembunyi (lihat handleSubmit).
  const [handles, setHandles] = useState<Record<SocialPlatform, string>>({
    TIKTOK: "",
    INSTAGRAM: "",
    YOUTUBE: "",
  });
  const [activePlatforms, setActivePlatforms] = useState<Set<SocialPlatform>>(
    new Set(["TIKTOK"]),
  );

  function togglePlatform(platform: SocialPlatform) {
    setActivePlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  const socialAccountsJson = JSON.stringify(
    [...activePlatforms]
      .filter((p) => handles[p].trim().length > 0)
      .map((platform) => ({ platform, handle: handles[platform].trim() })),
  );

  return (
    <Card float className="p-6 sm:p-7">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Daftar akun
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-brand-600">
          Masuk
        </Link>
      </p>

      {!googlePrefill ? (
        <>
          <div className="mt-6">
            <GoogleAuthButton label="Daftar dengan Google" />
          </div>
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs font-medium text-muted">atau</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : (
        <div className="mt-6">
          <Callout tone="success">
            Masuk dengan Google sebagai <strong>{googlePrefill.email}</strong>.
            Lengkapi sisa data di bawah untuk menyelesaikan pendaftaran.
          </Callout>
        </div>
      )}

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
        {googlePrefill ? (
          <input type="hidden" name="method" value="google" />
        ) : null}
        <FormError message={state.error} />

        <Field label={role === "VENDOR" ? "Nama PIC / pemilik" : "Nama lengkap"}>
          <Input name="name" required defaultValue={googlePrefill?.name ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input
              name="email"
              type="email"
              required
              defaultValue={googlePrefill?.email ?? ""}
              readOnly={Boolean(googlePrefill)}
              className={googlePrefill ? "bg-surface-muted text-muted" : undefined}
            />
          </Field>
          <Field label="Nomor HP">
            <Input name="phone" required placeholder="08xxxxxxxxxx" />
          </Field>
        </div>
        {!googlePrefill ? (
          <Field label="Password" hint="Minimal 8 karakter.">
            <Input name="password" type="password" required minLength={8} />
          </Field>
        ) : null}

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

            <div>
              <span className="text-sm font-semibold text-foreground">
                Platform media sosial
              </span>
              <p className="mt-0.5 text-xs text-muted">
                Pilih semua platform yang kamu pakai — tidak dibatasi satu.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map(({ value, label, Logo }) => {
                  const active = activePlatforms.has(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => togglePlatform(value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-line bg-surface text-muted hover:border-line-brand hover:text-foreground",
                      )}
                    >
                      <Logo className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {[...activePlatforms].length > 0 ? (
                <div className="mt-3 space-y-3">
                  {PLATFORM_OPTIONS.filter(({ value }) => activePlatforms.has(value)).map(
                    ({ value, label }) => (
                      <Field key={value} label={`Username ${label}`} hint="Tanpa tanda @.">
                        <Input
                          value={handles[value]}
                          onChange={(event) =>
                            setHandles((prev) => ({ ...prev, [value]: event.target.value }))
                          }
                          placeholder="username"
                        />
                      </Field>
                    ),
                  )}
                </div>
              ) : null}
              <input type="hidden" name="socialAccounts" value={socialAccountsJson} />
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
            <Field
              label="Link Google Maps"
              hint="Buka lokasi di Google Maps, tekan Bagikan, salin link-nya ke sini."
            >
              <Input
                name="mapsUrl"
                type="url"
                required
                placeholder="https://maps.app.goo.gl/..."
              />
            </Field>
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
