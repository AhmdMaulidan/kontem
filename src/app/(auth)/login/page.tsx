"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";
import {
  Card,
  Field,
  FormError,
  Input,
  PillLabel,
  SubmitButton,
} from "@/components/ui";

const akunDemo = [
  { label: "Creator", email: "dita@creator.id" },
  { label: "Vendor", email: "vendor@kopisenja.id" },
  { label: "Admin", email: "admin@kontem.id" },
];

export default function LoginPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    loginAction,
    {},
  );

  return (
    <div className="space-y-5">
      <Card float className="p-7">
        <PillLabel tone="sky">👋 Selamat datang kembali</PillLabel>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">
          Masuk ke Kontem
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Belum punya akun?{" "}
          <Link href="/register" className="font-semibold text-brand-600">
            Daftar gratis di sini
          </Link>
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <FormError message={state.error} />
          <Field label="Email">
            <Input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@email.com"
            />
          </Field>
          <Field label="Password">
            <Input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Memproses...">
            Masuk
          </SubmitButton>
        </form>
      </Card>

      <Card className="bg-surface-muted">
        <p className="text-sm font-bold text-foreground">Akun demo</p>
        <p className="mt-0.5 text-xs text-muted">
          Password semua akun:{" "}
          <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono">
            password123
          </code>
        </p>
        <ul className="mt-3 space-y-1.5">
          {akunDemo.map((akun) => (
            <li
              key={akun.email}
              className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-3 py-2"
            >
              <span className="text-xs font-semibold text-muted">
                {akun.label}
              </span>
              <code className="font-mono text-xs text-body">{akun.email}</code>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
