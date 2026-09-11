import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth";

const nav: NavItem[] = [
  { href: "/creator", label: "Dashboard" },
  { href: "/creator/campaigns", label: "Cari Campaign" },
  { href: "/creator/submissions", label: "Submission Saya" },
  { href: "/creator/earnings", label: "Penghasilan" },
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
