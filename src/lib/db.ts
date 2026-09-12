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

let cached: PrismaClient | undefined;

function getClient() {
  // Hot reload di dev membuat modul dievaluasi ulang; tanpa cache global
  // tiap reload membuka pool koneksi baru sampai Postgres menolak. Di
  // produksi cache modul sudah cukup — global sengaja tidak dikotori.
  cached ??= globalForPrisma.prisma ?? createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = cached;
  }
  return cached;
}

/**
 * Klien dibuat saat query PERTAMA, bukan saat modul diimpor.
 *
 * `next build` mengimpor tiap halaman untuk membaca konfigurasinya. Kalau
 * klien dibuat di ruang modul, impor itu sendiri sudah melempar saat
 * DATABASE_URL belum ada, sehingga build gagal di mesin yang memang tidak
 * memegang kredensial. Menunda pembuatannya membuat pesan error tetap muncul
 * di tempat yang benar — saat aplikasi sungguh butuh database — persis seperti
 * `secret()` di auth.ts yang membaca AUTH_SECRET di dalam fungsi.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
