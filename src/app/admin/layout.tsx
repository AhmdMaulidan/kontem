import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth";

const nav: NavItem[] = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/vendors", label: "Verifikasi Vendor" },
  { href: "/admin/campaigns", label: "Approval Campaign" },
  { href: "/admin/views", label: "Update Views" },
  { href: "/admin/disputes", label: "Sengketa" },
  { href: "/admin/fraud", label: "Fraud" },
  { href: "/admin/payouts", label: "Payout" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
