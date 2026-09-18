"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";
import { Card, Field, FormError, Input, SubmitButton } from "@/components/ui";
import { GoogleAuthButton } from "../google-auth-button";

export default function LoginPage() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    loginAction,
    {},
  );

  return (
    <Card float className="p-6 sm:p-7">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Masuk ke Kontem
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Belum punya akun?{" "}
        <Link href="/register" className="font-semibold text-brand-600">
          Daftar gratis di sini
        </Link>
      </p>

      <div className="mt-6">
        <GoogleAuthButton label="Masuk dengan Google" />
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-medium text-muted">atau</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={formAction} className="space-y-4">
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
  );
}
