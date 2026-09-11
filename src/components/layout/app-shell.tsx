import "server-only";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/_actions/session";
import { db } from "@/lib/db";
import { Badge, Button } from "@/components/ui";
import {
  roleLabel,
  verificationStatusLabel,
  verificationStatusTone,
} from "@/lib/labels";
import type { Role, VerificationStatus } from "@/generated/prisma/enums";

export type NavItem = { href: string; label: string };

const roleTone: Record<Role, "sky" | "accent" | "info"> = {
  CREATOR: "accent",
  VENDOR: "sky",
  ADMIN: "info",
};

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
  const inisial = user.name.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base text-white shadow-brand">
                📍
              </span>
              <span className="text-lg font-extrabold tracking-tight text-foreground">
                Kontem
              </span>
            </Link>
            <Badge tone={roleTone[user.role]}>{roleLabel[user.role]}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`${basePath}/notifications`}
              className="relative rounded-full p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand-600"
              aria-label="Notifikasi"
            >
              <span aria-hidden>🔔</span>
              {unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </Link>

            <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-3">
              <span className="hidden text-sm font-medium text-body sm:inline">
                {user.name}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {inisial}
              </span>
            </div>

            <form action={logoutAction}>
              <Button variant="ghost" type="submit" className="px-3 py-2">
                Keluar
              </Button>
            </form>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2.5">
          <ul className="flex gap-1.5 whitespace-nowrap">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand-soft hover:text-brand-700"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {user.status !== "VERIFIED" ? (
        <div className="border-b border-warning-line bg-warning-soft">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-warning">
            <Badge tone={verificationStatusTone[user.status]} icon>
              {verificationStatusLabel[user.status]}
            </Badge>
            <span>Beberapa fitur terkunci sampai verifikasi selesai.</span>
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
