import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kontem — Platform Location Campaign",
  description:
    "Menghubungkan vendor lokal dengan kreator konten. Bayar berdasarkan views, dana dikunci di escrow.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
