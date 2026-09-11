import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth";

const nav: NavItem[] = [
  { href: "/vendor", label: "Dashboard" },
  { href: "/vendor/campaigns/new", label: "Buat Campaign" },
  { href: "/vendor/submissions", label: "Review Submission" },
  { href: "/vendor/redeem", label: "Cek Kode Redeem" },
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
