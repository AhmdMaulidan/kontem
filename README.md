# Kontem

Platform *location campaign* yang menghubungkan vendor lokal (resto, destinasi
wisata) dengan kreator konten. Vendor mengunci budget di escrow, kreator datang
ke lokasi dan membuat konten, lalu pool dibagi proporsional menurut views yang
dihasilkan masing-masing kreator.

Tiga role: **Creator**, **Vendor**, **Admin**.

## Stack

| Bagian | Pilihan |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions) |
| Bahasa | TypeScript |
| Database | Supabase (PostgreSQL) + Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Styling | Tailwind CSS 4 |
| Auth | Session JWT sendiri (`jose` + cookie httpOnly), password di-hash bcrypt |
| Validasi | Zod |

## Menjalankan secara lokal

```bash
pnpm install
cp .env.example .env        # isi connection string Supabase + AUTH_SECRET

pnpm exec prisma migrate deploy   # buat tabel di Supabase
pnpm db:seed                      # isi data demo
pnpm dev                          # http://localhost:3000
```

`AUTH_SECRET` wajib minimal 32 karakter — buat dengan `openssl rand -base64 32`.

### Dua connection string

Supabase menyediakan beberapa connection string dengan peran berbeda, dan
proyek ini memakai dua di antaranya:

| Variabel | Sumber di Supabase | Port | Dipakai untuk |
| --- | --- | --- | --- |
| `DATABASE_URL` | Transaction pooler | 6543 | Runtime aplikasi |
| `DIRECT_URL` | Session pooler | 5432 | Migrasi dan seed |

Keduanya ada di **Project Settings → Database → Connection string**. Pemisahan
ini bukan opsional: Prisma Migrate menjalankan perintah DDL yang tidak didukung
transaction pooler, sehingga migrasi lewat port 6543 akan gagal. Sebaliknya,
runtime aplikasi justru sebaiknya lewat pooler supaya kuota koneksi project
tidak habis saat di-deploy ke platform serverless.

Pakai **pooler**, bukan direct connection (`db.[ref].supabase.co`) — direct
connection project baru hanya bisa diakses lewat IPv6 dan sering gagal di
jaringan kampus atau CI.

### Menjalankan dengan Postgres lokal

Isi `DATABASE_URL` dan `DIRECT_URL` dengan nilai yang sama:

```bash
createdb kontem
# DATABASE_URL="postgresql://USER@127.0.0.1:5432/kontem?schema=public"
# DIRECT_URL="postgresql://USER@127.0.0.1:5432/kontem?schema=public"
pnpm exec prisma migrate dev
pnpm db:seed
```

### Akun demo

Password semua akun: `password123`

| Role | Email | Catatan |
| --- | --- | --- |
| Admin | `admin@kontem.id` | Panel verifikasi, sengketa, payout |
| Vendor | `vendor@kopisenja.id` | Terverifikasi, punya campaign aktif & campaign selesai |
| Vendor | `vendor@sambalmbokdar.id` | Masih menunggu verifikasi admin |
| Creator | `dita@creator.id` | Malang, punya riwayat payout |
| Creator | `yoga@creator.id` | Punya submission yang sedang disengketakan |

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Build & jalankan produksi |
| `pnpm test` | Unit test logika payout |
| `pnpm typecheck` | Typecheck tanpa emit |
| `pnpm lint` | ESLint |
| `pnpm db:seed` | Isi ulang data demo (menghapus data lama) |
| `pnpm db:reset` | Drop, migrasi ulang, lalu seed |
| `pnpm db:studio` | Prisma Studio |

## Alur data lintas role

```
Vendor buat campaign (budget, CPM, kuota, brief)
        ↓  deposit budget pool masuk escrow
Admin approve campaign  →  campaign live di listing creator
        ↓
Creator klaim slot  →  dapat kode redeem
        ↓
Creator datang ke lokasi  →  vendor tandai kode terpakai (bukti kunjungan)
        ↓
Creator submit link konten
        ↓
Vendor review  →  approve / reject (alasan wajib)
        ↓                      ↓
        │                 Creator banding  →  Admin memutus
        ↓
Views dilacak selama periode campaign
        ↓
Admin settle campaign  →  views dikunci, payout dihitung proporsional
        ↓
Admin cairkan payout  →  fee platform dipotong, sisa pool balik ke vendor
```

## Model perhitungan payout

Ada di [`src/domain/payout.ts`](src/domain/payout.ts) sebagai fungsi murni tanpa
akses database, sehingga bisa diuji langsung dan dipakai ulang untuk menampilkan
estimasi earning ke creator saat campaign masih berjalan.

Dua aturan bekerja bersamaan:

1. **CPM rate menentukan tarif** — creator dibayar `views / 1000 × cpmRate`.
2. **Budget pool adalah plafon keras** — vendor tidak pernah membayar melebihi
   dana yang sudah dikunci.

Selama total tagihan CPM masih di bawah pool, tiap creator menerima penuh sesuai
tarif dan sisanya dikembalikan ke vendor. Begitu tagihan melampaui pool, seluruh
pool dibagi proporsional menurut views. Pembulatan memakai metode *largest
remainder* supaya jumlah seluruh baris payout persis sama dengan pool — tidak ada
rupiah yang hilang atau tercipta.

Fee platform dipotong dari bagian bruto tiap creator (`platformFeeRate`, default
15%).

## Guardrail kepercayaan dua sisi

Ini bagian yang membedakan platform dari sekadar papan lowongan:

- **Dana dikunci di muka.** Campaign tidak bisa live sebelum admin menandai
  deposit escrow lunas, jadi creator tidak pernah bekerja tanpa jaminan bayaran.
- **Bukti kunjungan wajib.** Konten hanya bisa dikirim setelah vendor menandai
  kode redeem creator terpakai di lokasi.
- **Penolakan wajib beralasan.** Vendor tidak bisa menolak submission tanpa
  menuliskan alasan; semuanya masuk audit trail.
- **Banding dan mediasi.** Creator bisa membanding penolakan, admin yang memutus,
  dan riwayat percakapan tersimpan.
- **Settle diblokir kalau ada sengketa terbuka**, supaya angka pembagian tidak
  berubah setelah dana terlanjur cair.
- **Flag fraud otomatis** saat angka views turun (views platform sosial tidak
  pernah berkurang), plus laporan manual dari vendor.
- **Payout ditahan** otomatis kalau kecurangan creator dikonfirmasi admin.

## Struktur direktori

Proyek dipisah menjadi empat lapisan dengan tanggung jawab yang tidak tumpang
tindih. Aturannya: `app/` hanya soal routing, `domain/` tidak boleh tahu soal
tampilan, dan `components/ui/` tidak boleh tahu soal database.

```
prisma/
  schema.prisma          model data lengkap + enum status
  seed.ts                data demo lintas-state
  migrations/            riwayat migrasi terversi

src/
  app/                   ROUTING — halaman, layout, dan server action
    _actions/            action yang dipakai lintas role (folder privat, bukan route)
    (auth)/              login, register, action autentikasi
    creator/             dashboard, cari campaign, submission, penghasilan
    vendor/              dashboard, buat campaign, review, cek kode redeem
    admin/               verifikasi vendor, approval, views, sengketa, fraud, payout

  components/            TAMPILAN — tanpa akses database
    ui/                  design system: button, card, badge, form, table, ...
    layout/              shell dashboard (header, navigasi, banner status)
    notifications/       komponen notifikasi yang dipakai ketiga role

  domain/                LOGIKA BISNIS — inti aturan main platform
    payout.ts            pembagian pool + Largest Remainder (fungsi murni)
    payout.test.ts       unit test perhitungan uang
    campaign.ts          performa campaign, dipakai ketiga role
    codes.ts             pembuatan kode redeem & token verifikasi medsos

  lib/                   INFRASTRUKTUR & UTILITAS
    db.ts                Prisma client singleton
    auth.ts              session, hashing, guard per role
    format.ts            format rupiah, tanggal, angka ringkas
    labels.ts            peta enum ke label Indonesia + warna badge

  generated/prisma/      hasil `prisma generate` (tidak masuk git)
```

### Aturan impor

Ringkasannya ada di bawah; aturan lengkap beserta contoh ada di
[CONVENTIONS.md](CONVENTIONS.md).

- Halaman **selalu** mengimpor komponen dari `@/components/ui`, tidak pernah
  langsung ke file per komponen. Penyesuaian visual cukup dilakukan di dalam
  folder `ui/` tanpa menyentuh satu pun halaman.
- Komponen khusus satu halaman (mis. form review vendor) tinggal bersebelahan
  dengan halamannya di `app/`, bukan di `components/`.
- `domain/payout.ts` tidak mengakses database sama sekali, sehingga bisa diuji
  langsung dan dipakai ulang untuk menampilkan estimasi ke creator.

## Yang masih di-mock di versi ini

Dipilih sadar supaya alur end-to-end bisa didemokan tanpa menunggu integrasi
eksternal. Antarmuka dan perhitungan di belakangnya tidak berubah saat nanti
diganti yang asli:

- **Views** diinput manual admin di `/admin/views`. Di produksi diganti job
  terjadwal yang menarik data dari API TikTok/Instagram.
- **Escrow & payout** berupa state di database. Belum tersambung payment gateway;
  admin yang menandai deposit lunas dan payout cair.
- **Verifikasi akun medsos creator** membuat token bio tapi belum ada pengecekan
  otomatis.
- **Google login** belum disambungkan (skema `User.googleId` sudah disiapkan).

## Keputusan yang masih terbuka

- Besaran fee platform. Saat ini default 15% dan bisa diatur per campaign lewat
  `Campaign.platformFeeRate`, tapi angkanya belum divalidasi terhadap margin yang
  masuk akal untuk UMKM.
- Status dana untuk submission yang sedang disengketakan. Sekarang settle
  diblokir sampai sengketa selesai; alternatifnya menahan porsi dana tertentu dan
  tetap mencairkan sisanya.

## Lisensi

Proyek ini dirilis di bawah [Lisensi MIT](LICENSE) — bebas dipakai, diubah, dan
didistribusikan, termasuk untuk keperluan komersial, selama pemberitahuan hak
cipta dan teks lisensinya ikut disertakan.

Aset di `public/` punya ketentuannya sendiri dan **tidak** tercakup lisensi ini
secara otomatis; sumber dan lisensi tiap aset dicatat di
`public/illustrations/README.md` dan `public/demo/README.md`.

