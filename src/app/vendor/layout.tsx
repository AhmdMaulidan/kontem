import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth";

const nav: NavItem[] = [
  { href: "/vendor", label: "Dashboard", icon: "dashboard" },
  { href: "/vendor/campaigns", label: "Semua Campaign", icon: "campaign" },
  { href: "/vendor/campaigns/new", label: "Buat Campaign", icon: "plus" },
];

export default async function VendorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole("VENDOR");
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
