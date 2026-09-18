import { getPendingGoogleProfile } from "@/lib/google-auth";
import { RegisterForm } from "./register-form";

/**
 * Server Component tipis: satu-satunya alasan halaman ini bukan Client
 * Component penuh adalah `getPendingGoogleProfile()` yang membaca cookie
 * httpOnly (tidak bisa diakses dari client) — sisanya dilempar ke
 * `RegisterForm` sebagai props biasa.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; method?: string }>;
}) {
  const params = await searchParams;
  const isGoogleFlow = params.method === "google";
  const pending = isGoogleFlow ? await getPendingGoogleProfile() : null;

  return (
    <RegisterForm
      defaultRole={params.role === "vendor" ? "VENDOR" : "CREATOR"}
      googlePrefill={pending ? { email: pending.email, name: pending.name } : null}
    />
  );
}
