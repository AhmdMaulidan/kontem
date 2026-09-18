# 📚 Panduan Migration & Seed Database - Kontem

Dokumentasi lengkap untuk menjalankan migrasi database dan seeding data demo di project Kontem.

---

## 📋 Daftar Isi
1. [Quick Start](#quick-start)
2. [Menjalankan Migrasi](#menjalankan-migrasi)
3. [Menjalankan Seed](#menjalankan-seed)
4. [Membuat Migrasi Baru](#membuat-migrasi-baru)
5. [Troubleshooting](#troubleshooting)
6. [Best Practices](#best-practices)

---

## 🚀 Quick Start

Untuk environment development baru, jalankan:

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment variables
cp .env.example .env.local

# 3. Jalankan migrasi terbaru
pnpm exec prisma migrate dev

# 4. Database sudah siap dengan data demo!
```

---

## 🗄️ Menjalankan Migrasi

### Melihat Status Migrasi

Cek migrasi mana yang sudah diterapkan dan mana yang pending:

```bash
pnpm exec prisma migrate status
```

**Output yang diharapkan:**
```
5 migrations found in prisma/migrations
Following migrations have not yet been applied:
20260915000000_fee_platform_3_persen
...
```

### Menerapkan Migrasi (Development)

```bash
pnpm exec prisma migrate dev
```

**Apa yang terjadi:**
- Membaca semua file `migration.sql` di folder `prisma/migrations/`
- Menerapkan migrasi yang belum diterapkan ke database
- Otomatis menjalankan seed script (`prisma/seed.ts`)
- Generate ulang Prisma Client dengan schema terbaru

### Menerapkan Migrasi (Production)

```bash
pnpm exec prisma migrate deploy
```

**Catatan:** 
- Jangan menjalankan `migrate dev` di production
- Migrasi di production bersifat read-only (tidak generate Prisma Client)

### Reset Database (⚠️ Hati-hati!)

Hapus semua data dan mulai dari awal:

```bash
pnpm exec prisma migrate reset
```

**Apa yang terjadi:**
1. Menghapus semua tabel dan data
2. Menerapkan semua migrasi dari awal
3. Menjalankan seed script
4. Generate Prisma Client

---

## 🌱 Menjalankan Seed

### Otomatis (Recommended)

Seed otomatis berjalan saat `pnpm exec prisma migrate dev`:

```bash
pnpm exec prisma migrate dev
```

### Manual

Jika ingin seed tanpa migrasi:

```bash
pnpm exec prisma db seed
```

### Apa yang Diseed

File: `prisma/seed.ts`

Data demo yang dibuat:
- ✅ 1 Admin (`admin@kontem.id`)
- ✅ 7 Verified Vendor + 1 Pending Vendor
- ✅ 5 Creator dengan berbagai followers & trust score
- ✅ 8 Active Campaign + 1 Pending + 1 Settled
- ✅ Submissions, Views, Disputes, Fraud Flags
- ✅ Notifications & Audit Logs
- ✅ Payout Calculations

**Akun Demo:**
```
Password untuk semua: password123

Admin:
  Email: admin@kontem.id

Vendor (Verified):
  vendor@kopisenja.id
  vendor@tumpaksewu.id
  vendor@kafearsip.id
  vendor@pantailestari.id
  vendor@danautirta.id
  vendor@panggungkota.id

Vendor (Pending):
  vendor@sambalmbokdar.id

Creators:
  dita@creator.id
  reza@creator.id
  nabila@creator.id
  yoga@creator.id
  sinta@creator.id
```

---

## ➕ Membuat Migrasi Baru

### Saat Schema Berubah

**Langkah 1:** Edit `prisma/schema.prisma`

```prisma
model Campaign {
  // ... field existing ...
  newField String? // Field baru
}
```

**Langkah 2:** Buat migrasi

```bash
pnpm exec prisma migrate dev --name nama_migrasi_deskriptif
```

Ganti `nama_migrasi_deskriptif` dengan deskripsi singkat:
- ✅ `tambah_kolom_bank_vendor_dan_max_views`
- ✅ `hapus_redeem_dan_klaim_slot`
- ❌ `update` (terlalu vague)

**Langkah 3:** Review file migrasi

File akan dibuat di `prisma/migrations/[timestamp]_[nama]/migration.sql`

```sql
-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "newField" TEXT;
```

### Mendiskusikan Migrasi

Saat membuat migrasi kompleks, tambahkan komentar:

```sql
-- Kolom newField wajib nullable karena campaign lama tidak punya data ini.
-- Data akan diisi batch update terpisah setelah migrasi selesai.
ALTER TABLE "Campaign" ADD COLUMN "newField" TEXT;
```

---

## 🐛 Troubleshooting

### ❌ "The column 'Campaign.maxCreators' does not exist"

**Penyebab:** Prisma Client cache masih menggunakan schema lama

**Solusi:**
```bash
# Hapus generated files dan regenerate
rm -rf src/generated
pnpm exec prisma generate

# Atau reset .next cache
rm -rf .next
pnpm build
```

### ❌ "P1001: Can't reach database server"

**Penyebab:** Database tidak running atau URL salah

**Solusi:**
```bash
# 1. Cek file .env.local
cat .env.local | grep DATABASE_URL

# 2. Verifikasi PostgreSQL running
psql -U postgres -h localhost

# 3. Jika PostgreSQL tidak ada, install atau gunakan Docker
docker run --name postgres -e POSTGRES_PASSWORD=postgres -d postgres
```

### ❌ "Database already exists but is empty"

**Penyebab:** Database dibuat tapi tidak ada schema

**Solusi:**
```bash
# Drop dan recreate
dropdb kontem
createdb kontem

# Jalankan migrasi
pnpm exec prisma migrate dev
```

### ❌ Seed Failed - "Argument 'maxCreators' is missing"

**Penyebab:** Seed script outdated setelah migrasi

**Solusi:**
```bash
# Update seed.ts sesuai schema terbaru, atau
pnpm exec prisma db seed
```

### ❌ "prisma: command not found"

**Penyebab:** pnpm packages belum install

**Solusi:**
```bash
pnpm install
```

---

## ✅ Best Practices

### 1. **Selalu Test Migrasi Lokal Dulu**

```bash
# Buat di development
pnpm exec prisma migrate dev --name feature_baru

# Test dengan data nyata
pnpm exec prisma db seed

# Jalankan tests
pnpm test
```

### 2. **Jangan Pernah Edit Migrasi Lama**

❌ **Salah:**
```bash
# Jangan ubah file migrasi yang sudah diterapkan!
# Ini akan inconsistent dengan database production
```

✅ **Benar:**
```bash
# Buat migrasi baru jika perlu diubah
pnpm exec prisma migrate dev --name fix_previous_migration
```

### 3. **Commit Migrasi ke Git**

Folder `prisma/migrations/` **harus** di-commit:

```bash
git add prisma/migrations/
git commit -m "feat: add migration untuk feature baru"
```

Jangan di-gitignore!

### 4. **Sinkronkan Schema dengan Type Definitions**

Setelah migrasi:

```bash
# Generate Prisma Client dengan schema terbaru
pnpm exec prisma generate
```

Ini mengupdate `src/generated/prisma/` dengan types terbaru.

### 5. **Reset Database Saat Development Stuck**

Jika state database sudah kacau:

```bash
# Reset semua (safe untuk development)
pnpm exec prisma migrate reset

# Atau manual reset
pnpm exec prisma migrate resolve --rolled-back [timestamp]
pnpm exec prisma migrate dev
```

### 6. **Backup Sebelum Production Migration**

```bash
# Backup database production
pg_dump -U postgres kontem > backup_$(date +%Y%m%d).sql

# Run migration
pnpm exec prisma migrate deploy

# Jika ada error, restore
psql -U postgres kontem < backup_20260918.sql
```

---

## 🔧 Konfigurasi Environment

### .env.local (Development)

```env
# Database - Development (gunakan DIRECT_URL untuk seed)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kontem?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/kontem?schema=public"

# Auth
NEXTAUTH_SECRET="dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

### .env.production

```env
# Database - Production (gunakan connection pooler untuk aplikasi)
DATABASE_URL="postgresql://user:password@pooler.prod.com:6543/kontem?schema=public"

# Untuk seed/admin tasks, gunakan direct connection
DIRECT_URL="postgresql://user:password@db.prod.com:5432/kontem?schema=public"

# Auth
NEXTAUTH_SECRET="[strong-random-secret]"
NEXTAUTH_URL="https://kontem.co.id"
```

**Catatan:** `DIRECT_URL` adalah koneksi langsung ke database tanpa pooler (diperlukan untuk seed).

---

## 📊 Workflow Typical Development

```bash
# 1. Pull kode terbaru
git pull origin main

# 2. Install dependencies baru (jika ada)
pnpm install

# 3. Jalankan migrasi + seed
pnpm exec prisma migrate dev

# 4. Jalankan dev server
pnpm dev

# 5. Buat fitur baru dan ubah schema
# ... edit schema.prisma ...

# 6. Buat migrasi untuk fitur
pnpm exec prisma migrate dev --name feature_baru

# 7. Test lokal
pnpm test
pnpm lint
pnpm typecheck

# 8. Commit & push
git add .
git commit -m "feat: tambah feature baru"
git push origin feature/feature-baru
```

---

## 📞 Resources

- **Prisma Docs:** https://www.prisma.io/docs/orm/prisma-migrate/overview
- **Database Schema:** `prisma/schema.prisma`
- **Migrations:** `prisma/migrations/`
- **Seed Script:** `prisma/seed.ts`
- **Environment Config:** `.env.local` (git-ignored)

---

*Last updated: September 2026*
