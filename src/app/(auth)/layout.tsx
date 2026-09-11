import Link from "next/link";
import type { ReactNode } from "react";
import { IconPin } from "@/components/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-3.5">
          <Link href="/" className="flex w-fit items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <IconPin className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Kontem
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
        {children}
      </main>
    </div>
  );
}
