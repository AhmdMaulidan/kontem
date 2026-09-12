import "server-only";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { DashboardChrome, type NavItem } from "./dashboard-chrome";
import type { Role, VerificationStatus } from "@/generated/prisma/enums";

export type { NavItem };

/**
 * Rangka dasbor untuk ketiga role.
 *
 * Komponen ini hanya mengambil datanya (jumlah notifikasi belum dibaca milik
 * pengguna sendiri, lihat CONVENTIONS bagian 1) lalu menyerahkan seluruh
 * tampilan ke `DashboardChrome` yang berjalan di klien karena laci menunya
 * butuh state.
 */
export async function AppShell({
  user,
  nav,
  children,
}: {
  user: { id: string; name: string; role: Role; status: VerificationStatus };
  nav: NavItem[];
  children: ReactNode;
}) {
  const unread = await db.notification.count({
    where: { userId: user.id, readAt: null },
  });

  const basePath = nav[0].href.split("/").slice(0, 2).join("/");

  return (
    <DashboardChrome
      user={{ name: user.name, role: user.role, status: user.status }}
      nav={nav}
      basePath={basePath}
      unread={unread}
    >
      {children}
    </DashboardChrome>
  );
}
