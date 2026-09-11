import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div className="blob -top-24 -left-20 h-72 w-72 bg-brand-200" />
      <div className="blob top-10 right-0 h-64 w-64 bg-accent-100" />

      <header className="relative border-b border-line bg-surface/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3.5">
          <Link href="/" className="flex w-fit items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base text-white shadow-brand">
              📍
            </span>
            <span className="text-xl font-extrabold tracking-tight text-foreground">
              Kontem
            </span>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-xl flex-1 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
