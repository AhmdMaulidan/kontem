import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth";

const nav: NavItem[] = [
  // Urutannya mengikuti alur kerja admin: verifikasi -> campaign ->
  // operasional harian -> uang -> laporan.
  { href: "/admin", label: "Ringkasan", icon: "dashboard" },
  { href: "/admin/vendors", label: "Verifikasi Vendor", icon: "vendor" },
  { href: "/admin/creators", label: "Verifikasi Creator", icon: "creator" },
  { href: "/admin/campaigns", label: "Approval Campaign", icon: "campaign" },
  { href: "/admin/submissions", label: "Review Submission", icon: "review" },
  { href: "/admin/views", label: "Update Views", icon: "views" },
  { href: "/admin/payouts", label: "Payout", icon: "payout" },
  { href: "/admin/disputes", label: "Sengketa", icon: "dispute" },
  { href: "/admin/fraud", label: "Fraud", icon: "fraud" },
  { href: "/admin/analytics", label: "Analitik", icon: "analytics" },
  { href: "/admin/escrow", label: "Escrow", icon: "escrow" },
  { href: "/admin/templates", label: "Template Brief", icon: "template" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <AppShell user={user} nav={nav} notificationsMode="dropdown">
      {children}
    </AppShell>
  );
}
