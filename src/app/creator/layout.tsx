import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth";

const nav: NavItem[] = [
  { href: "/creator", label: "Dashboard", icon: "dashboard" },
  { href: "/creator/campaigns", label: "Cari Campaign", icon: "explore" },
  { href: "/creator/submissions", label: "Submission Saya", icon: "submission" },
  { href: "/creator/earnings", label: "Penghasilan", icon: "earnings" },
  { href: "/creator/notifications", label: "Notifikasi", icon: "notification" },
];

export default async function CreatorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole("CREATOR");
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
