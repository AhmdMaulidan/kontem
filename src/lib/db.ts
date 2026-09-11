import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  // Runtime aplikasi memakai transaction pooler Supabase (DATABASE_URL).
  // Migrasi dan seed memakai DIRECT_URL — lihat prisma.config.ts.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diset. Salin .env.example jadi .env.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // Pooler Supabase sudah membagi koneksi ke banyak klien, jadi tiap
      // instance aplikasi cukup memegang sedikit koneksi. Angka besar di sisi
      // ini justru menghabiskan kuota koneksi project.
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      // Putuskan koneksi menganggur supaya instance serverless yang tidur
      // tidak menahan slot pooler.
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    }),
  });
}

// Hot reload di dev membuat modul dievaluasi ulang; tanpa cache global
// tiap reload membuka pool koneksi baru sampai Postgres menolak.
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
