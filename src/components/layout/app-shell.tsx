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
  notificationsMode = "page",
}: {
  user: { id: string; name: string; role: Role; status: VerificationStatus };
  nav: NavItem[];
  children: ReactNode;
  /** "dropdown" menampilkan isi notifikasi langsung dari lonceng, tanpa halaman tersendiri. */
  notificationsMode?: "page" | "dropdown";
}) {
  const basePath = nav[0].href.split("/").slice(0, 2).join("/");

  const [unread, notifications] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    notificationsMode === "dropdown"
      ? db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve(null),
  ]);

  return (
    <DashboardChrome
      user={{ name: user.name, role: user.role, status: user.status }}
      nav={nav}
      basePath={basePath}
      unread={unread}
      notifications={notifications}
    >
      {children}
    </DashboardChrome>
  );
}
