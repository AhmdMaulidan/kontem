"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/_actions/session";
import { markAllReadAction } from "@/app/_actions/notifications";
import {
  Badge,
  Button,
  EmptyState,
  IconBell,
  IconLogout,
  IconMenu,
  IconX,
  Logo,
  cn,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import {
  roleLabel,
  verificationStatusLabel,
  verificationStatusTone,
} from "@/lib/labels";
import type { Role, VerificationStatus } from "@/generated/prisma/enums";
import { navIcons, type NavIconName } from "./nav-icons";

export type NavItem = { href: string; label: string; icon: NavIconName };

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: Date;
  readAt: Date | null;
};

type ChromeUser = {
  name: string;
  role: Role;
  status: VerificationStatus;
};

/**
 * Rangka dasbor: menu samping tetap di kiri pada layar lebar, laci yang
 * ditarik dari kiri pada ponsel.
 *
 * Seluruh rangka jadi satu Client Component supaya tombol menu di bilah atas
 * dan lacinya berbagi satu state — kalau dipisah, keduanya perlu context
 * tersendiri untuk hal yang hanya satu boolean.
 */
export function DashboardChrome({
  user,
  nav,
  basePath,
  unread,
  notifications,
  children,
}: {
  user: ChromeUser;
  nav: NavItem[];
  basePath: string;
  unread: number;
  /** Kalau diisi, lonceng membuka dropdown berisi daftar ini alih-alih menautkan ke halaman. */
  notifications?: NotificationItem[] | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerTerbuka, setDrawerTerbuka] = useState(false);
  const [notifTerbuka, setNotifTerbuka] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifTerbuka) return;
    function onClickLuar(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifTerbuka(false);
      }
    }
    document.addEventListener("mousedown", onClickLuar);
    return () => document.removeEventListener("mousedown", onClickLuar);
  }, [notifTerbuka]);

  const inisial = user.name.charAt(0).toUpperCase();
  const halamanNotifikasi = `${basePath}/notifications`;

  return (
    <div className="min-h-full bg-surface lg:pl-64">
      {/* ------------------------------------------------ menu samping */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <SidebarContent
          user={user}
          nav={nav}
          pathname={pathname}
          inisial={inisial}
        />
      </aside>

      {/* ------------------------------------------- laci untuk ponsel */}
      {drawerTerbuka ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setDrawerTerbuka(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface shadow-float">
            {/* Laci ditutup lewat onTutup saat salah satu menunya ditekan —
                tanpa itu laci tetap menutupi halaman yang baru dibuka. */}
            <SidebarContent
              user={user}
              nav={nav}
              pathname={pathname}
              inisial={inisial}
              onTutup={() => setDrawerTerbuka(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-full flex-col">
        {/* ------------------------------------------------- bilah atas */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDrawerTerbuka(true)}
                aria-label="Buka menu"
                className="-ml-1 rounded-xl p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand-700 lg:hidden"
              >
                <IconMenu className="h-5 w-5" strokeWidth={2} />
              </button>
              <Link href="/" className="lg:hidden">
                <Logo className="h-7" />
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {notifications ? (
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setNotifTerbuka((v) => !v)}
                    className="relative rounded-full p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand-600"
                    aria-label="Notifikasi"
                  >
                    <IconBell className="h-[18px] w-[18px]" strokeWidth={2} />
                    {unread > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    ) : null}
                  </button>

                  {notifTerbuka ? (
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[85vw] rounded-2xl border border-line bg-surface shadow-float">
                      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">
                          Notifikasi
                        </p>
                        {unread > 0 ? (
                          <form action={markAllReadAction}>
                            <input type="hidden" name="path" value={pathname} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-brand-600 hover:text-brand-700"
                            >
                              Tandai semua dibaca
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-4">
                            <EmptyState title="Belum ada notifikasi" />
                          </div>
                        ) : (
                          <ul className="divide-y divide-line">
                            {notifications.map((n) => {
                              const isi = (
                                <div
                                  className={cn(
                                    "px-4 py-3",
                                    n.readAt ? "" : "bg-brand-soft/40",
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {n.title}
                                    </p>
                                    <span className="whitespace-nowrap text-[11px] text-muted">
                                      {formatDateTime(n.createdAt)}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted">
                                    {n.body}
                                  </p>
                                </div>
                              );
                              return (
                                <li key={n.id}>
                                  {n.link ? (
                                    <Link
                                      href={n.link}
                                      onClick={() => setNotifTerbuka(false)}
                                      className="block hover:bg-surface-muted"
                                    >
                                      {isi}
                                    </Link>
                                  ) : (
                                    isi
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  href={halamanNotifikasi}
                  className="relative rounded-full p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand-600"
                  aria-label="Notifikasi"
                >
                  <IconBell className="h-[18px] w-[18px]" strokeWidth={2} />
                  {unread > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  ) : null}
                </Link>
              )}

              <div className="hidden items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-3 sm:flex">
                <span className="text-sm font-medium text-body">
                  {user.name}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {inisial}
                </span>
              </div>

              <form action={logoutAction}>
                <Button variant="ghost" type="submit" size="compact">
                  Keluar
                </Button>
              </form>
            </div>
          </div>
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

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 bg-surface">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  user,
  nav,
  pathname,
  inisial,
  onTutup,
}: {
  user: ChromeUser;
  nav: NavItem[];
  pathname: string;
  inisial: string;
  onTutup?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <Link href="/" className="flex items-center">
          <Logo className="h-8" />
        </Link>
        {onTutup ? (
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup menu"
            className="rounded-xl p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand-700"
          >
            <IconX className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {nav.map((item) => {
            const Ikon = navIcons[item.icon];
            const aktif = isAktif(pathname, item.href, nav);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onTutup}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors",
                    aktif
                      ? "bg-brand-50 text-brand-700"
                      : "text-muted hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  <Ikon
                    className={cn(
                      "h-4.5 w-4.5 shrink-0",
                      aktif ? "text-brand-600" : "text-muted",
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-2xl bg-surface-muted px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {inisial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted">{roleLabel[user.role]}</p>
          </div>
        </div>
        <form action={logoutAction} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <IconLogout className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
            Keluar
          </button>
        </form>
      </div>
    </>
  );
}

/**
 * Menyorot satu menu saja.
 *
 * Dicek dengan `startsWith` mentah, `/admin` ikut cocok dengan semua halaman
 * di bawahnya sehingga beranda dan menu halaman sekarang sama-sama menyala.
 * Karena itu: kalau ada menu yang URL-nya persis sama, hanya itu yang aktif;
 * kalau tidak ada (mis. halaman detail `/admin/disputes/123`), yang aktif
 * adalah menu terpanjang yang mengawali URL sekarang.
 */
function isAktif(pathname: string, href: string, nav: NavItem[]) {
  const persis = nav.find((item) => item.href === pathname);
  if (persis) return persis.href === href;

  const terpanjang = nav
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return terpanjang?.href === href;
}
