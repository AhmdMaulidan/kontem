import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 tidak lagi memuat .env otomatis, jadi dotenv diimpor di atas.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    // Migrasi harus lewat koneksi langsung/session pooler. Transaction pooler
    // Supabase (port 6543) tidak mendukung perintah DDL yang dipakai Prisma
    // Migrate, jadi DIRECT_URL didahulukan.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "pnpm exec tsx prisma/seed.ts",
  },
});
