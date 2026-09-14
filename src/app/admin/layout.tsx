import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth";

const nav: NavItem[] = [
  { href: "/admin", label: "Ringkasan", icon: "dashboard" },
  { href: "/admin/vendors", label: "Verifikasi Vendor", icon: "vendor" },
  { href: "/admin/campaigns", label: "Approval Campaign", icon: "campaign" },
  { href: "/admin/analyzer", label: "Agentic Analyze", icon: "campaign" },
  { href: "/admin/views", label: "Update Views", icon: "views" },
  { href: "/admin/disputes", label: "Sengketa", icon: "dispute" },
  { href: "/admin/fraud", label: "Fraud", icon: "fraud" },
  { href: "/admin/payouts", label: "Payout", icon: "payout" },
  { href: "/admin/notifications", label: "Notifikasi", icon: "notification" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
