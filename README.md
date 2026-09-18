# Kontem

Platform *location campaign* yang menghubungkan vendor lokal (resto, destinasi
wisata) dengan kreator konten. Vendor mengunci budget di escrow, kreator datang
ke lokasi dan membuat konten, lalu pool dibagi proporsional menurut views yang
dihasilkan masing-masing kreator. Creator juga bisa menarik penghasilan satu
video lebih awal — sebelum campaign berakhir — tanpa menunggu settlement akhir.

Tiga role: **Creator**, **Vendor**, **Admin**.

## Stack

| Bagian | Pilihan |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions) |
| Bahasa | TypeScript |
| Database | Supabase (PostgreSQL) + Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Styling | Tailwind CSS 4 |
| Auth | Session JWT sendiri (`jose` + cookie httpOnly), password di-hash bcrypt; login Google (OAuth 2.0) opsional |
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

Login dengan Google bersifat opsional: tombolnya selalu tampil, tapi baru
berfungsi setelah `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` diisi di `.env`
(lihat `.env.example`). Tanpa itu, tombolnya akan mengarahkan balik ke halaman
login dengan pesan yang jelas — bukan error.

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

Password semua akun: `password123`. Datanya dibuat oleh `prisma/seed.ts` dan
sengaja mencakup satu contoh untuk tiap kemungkinan status di aplikasi —
termasuk fitur **penarikan dana dini** dalam berbagai tahapan sekaligus.

| Role | Email | Skenario yang bisa dilihat |
| --- | --- | --- |
| Admin | `admin@kontem.id` | Verifikasi vendor, approval campaign, review submission, riwayat payout, approval penarikan dana |
| Vendor | `vendor@baksoenggal.id` | Terverifikasi, campaign aktif berjalan |
| Vendor | `vendor@tokodjawa.id` | Terverifikasi, campaign aktif berjalan |
| Vendor | `vendor@petakenam.id` | Terverifikasi, campaign aktif berjalan |
| Vendor | `vendor@cobanrondo.id` | Campaign masih menunggu approval admin |
| Vendor | `vendor@segosambelmarem.id` | Akun vendor masih **menunggu verifikasi** admin |
| Creator | `sibungbung@creator.id` | Video sudah disetujui & siap ditarik, **belum diajukan** penarikannya — coba klik "Tarik Dana" di `/creator/earnings` |
| Creator | `auntyfeni@creator.id` | Sudah mengajukan penarikan, **menunggu approval admin** — coba approve dari akun admin |
| Creator | `byanhard@creator.id` | Penarikan **sudah cair (PAID)** — riwayat lengkap sampai ke `/admin/escrow` |
| Creator | `petakenam@creator.id` | Video sudah disetujui & siap ditarik, belum diajukan |
| Creator | `rekurae@creator.id` | Penarikan pernah diajukan lalu **ditolak** admin |
| Creator | `yuanda@creator.id` | Submission masih **menunggu review** vendor/admin |

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Build & jalankan produksi |
| `pnpm test` | Unit test domain (payout, penarikan dana, dll) |
| `pnpm typecheck` | Typecheck tanpa emit |
| `pnpm lint` | ESLint |
| `pnpm db:seed` | Isi ulang data demo (menghapus data lama) |
| `pnpm db:reset` | Drop, migrasi ulang, lalu seed |
| `pnpm db:studio` | Prisma Studio |

## Alur data lintas role

```
Vendor buat campaign (budget, CPM, brief)
        ↓  deposit budget pool ditransfer manual, dikonfirmasi admin di escrow
Admin approve campaign  →  campaign live di listing creator
        ↓
Creator submit link konten
        ↓
Vendor / Admin review  →  approve / reject (alasan wajib, tercatat di audit log)
        ↓
Views dilacak selama periode campaign berjalan
        ↓
   ┌─────────────────────────┴─────────────────────────┐
   ↓                                                     ↓
Creator ajukan penarikan dana dini per video        Campaign selesai (masa
(first-come-first-served, tidak pernah melebihi     pelacakan views berakhir)
budget pool) → admin approve → admin tandai              ↓
sudah ditransfer                                    Sistem hitung & bayar
                                                     payout OTOMATIS — video
                                                     yang sudah ditarik dini
                                                     dikecualikan dari
                                                     perhitungan ulang
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
**3%**, bisa diatur per campaign).

### Penarikan dana dini (early withdrawal)

Ada di [`src/domain/withdrawal.ts`](src/domain/withdrawal.ts), memakai mekanisme
berbeda dari settlement akhir: **first-come-first-served**. Begitu satu
penarikan disetujui, jumlahnya langsung mengurangi sisa budget pool secara
permanen — tidak ada pembagian ulang proporsional untuk creator yang sudah
menarik duluan. Reservasi terhadap pool terjadi **saat request diajukan**
(dalam transaksi database `Serializable`), bukan saat admin approve, supaya dua
creator yang mengajukan bersamaan saat pool tinggal cukup untuk satu tidak
sama-sama lolos.

Video yang sudah dicairkan lewat penarikan dini dikecualikan dari perhitungan
proporsional saat settlement akhir, dan sisa pool untuk creator lain dikurangi
sebesar itu — vendor tetap tidak pernah membayar lebih dari budget pool.

## Guardrail kepercayaan dua sisi

Ini bagian yang membedakan platform dari sekadar papan lowongan:

- **Dana dikunci di muka.** Campaign tidak bisa live sebelum admin menandai
  deposit escrow lunas, jadi creator tidak pernah bekerja tanpa jaminan bayaran.
- **Penolakan wajib beralasan.** Submission tidak bisa ditolak tanpa menuliskan
  alasan; semuanya masuk audit trail. Penolakan bersifat final.
- **Penarikan dini tidak pernah melebihi pool.** Hard-cap dijamin lewat transaksi
  database terkunci, bukan sekadar validasi di permukaan.
- **Penarikan dini wajib disetujui admin** sebelum dana benar-benar ditransfer —
  ada jeda tinjauan manusia sebelum uang keluar.
- **Settlement akhir sepenuhnya otomatis.** Begitu masa pelacakan views sebuah
  campaign berakhir, sistem langsung menghitung dan membayar payout tanpa
  menunggu aksi admin — menghilangkan risiko dana tertahan karena admin lupa.
- **Semua aksi yang mengubah uang atau status tercatat di `AuditLog`.**

## Struktur direktori

Proyek dipisah menjadi empat lapisan dengan tanggung jawab yang tidak tumpang
tindih. Aturannya: `app/` hanya soal routing, `domain/` tidak boleh tahu soal
tampilan, dan `components/ui/` tidak boleh tahu soal database.

```
prisma/
  schema.prisma          model data lengkap + enum status
  seed.ts                data demo lintas-state (termasuk skenario penarikan dana)
  migrations/             riwayat migrasi terversi

src/
  app/                   ROUTING — halaman, layout, dan server action
    _actions/            action yang dipakai lintas role (folder privat, bukan route)
    api/auth/google/      rute OAuth Google (inisiasi + callback)
    (auth)/               login, register, action autentikasi
    creator/               dashboard, cari campaign, submission, penghasilan & penarikan dana
    vendor/                dashboard, buat campaign, review, escrow
    admin/                 verifikasi vendor, approval campaign, review submission,
                            approval penarikan dana, riwayat payout, escrow

  components/            TAMPILAN — tanpa akses database
    ui/                  design system: button, card, badge, form, table, ...
    layout/              shell dashboard (header, navigasi, banner status)
    notifications/       komponen notifikasi yang dipakai ketiga role

  domain/                 LOGIKA BISNIS — inti aturan main platform
    payout.ts             pembagian pool settlement akhir + Largest Remainder (fungsi murni)
    withdrawal.ts          perhitungan penarikan dana dini per video (fungsi murni)
    lifecycle.ts            transisi status campaign + settlement otomatis terjadwal
    campaign.ts             performa campaign, dipakai ketiga role
    codes.ts                pembuatan token verifikasi kepemilikan akun medsos
    *.test.ts                unit test tiap modul di atas

  lib/                   INFRASTRUKTUR & UTILITAS
    db.ts                Prisma client singleton
    auth.ts               session, hashing, guard per role
    google-auth.ts         helper OAuth Google
    format.ts               format rupiah, tanggal, angka ringkas
    labels.ts                peta enum ke label Indonesia + warna badge

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
- `domain/payout.ts` dan `domain/withdrawal.ts` tidak mengakses database sama
  sekali, sehingga bisa diuji langsung dan dipakai ulang untuk menampilkan
  estimasi ke creator.

## Tools & AI yang dipakai

Didokumentasikan secara transparan sesuai ketentuan lomba soal penggunaan tools
pihak ketiga dan AI:

- **Claude Code (Anthropic)** dipakai sebagai alat bantu pengembangan selama
  proyek berjalan — mulai dari implementasi fitur, migrasi database, perbaikan
  bug, sampai penulisan dokumentasi ini. Tim tetap bertanggung jawab meninjau,
  menguji (`typecheck`/`lint`/`test`/`build`), dan memverifikasi langsung setiap
  perubahan sebelum dianggap selesai.
- **Framework & library pihak ketiga**: Next.js, Prisma, Tailwind CSS, Zod,
  `jose` (JWT), `bcryptjs` (hashing password) — semuanya sudah tercantum di
  `package.json` dan tabel Stack di atas.
- **Aset ilustrasi** bersumber dari [unDraw](https://undraw.co) (diwarnai ulang
  sesuai palet, lihat `public/illustrations/README.md`) dan foto demo dari
  [Lorem Picsum](https://picsum.photos)/Unsplash (lisensi bebas komersial,
  lihat `public/demo/README.md`) — bukan aset berhak cipta pihak lain.
- Tidak ada bagian aplikasi yang berasal dari template/boilerplate siap pakai
  tanpa modifikasi; struktur folder, skema database, logika bisnis, dan seluruh
  antarmuka disusun khusus untuk Kontem (lihat `CONVENTIONS.md` dan
  `design.md` untuk aturan mainnya).

## Yang masih di-mock di versi ini

Dipilih sadar supaya alur end-to-end bisa didemokan tanpa menunggu integrasi
eksternal. Antarmuka dan perhitungan di belakangnya tidak berubah saat nanti
diganti yang asli:

- **Views** diinput manual admin di `/admin/views` (atau ditarik semi-otomatis
  lewat extractor ringan HTTP untuk TikTok/YouTube). Di produksi diganti job
  terjadwal yang menarik data resmi dari API TikTok/Instagram.
- **Deposit escrow & refund** dikonfirmasi manual oleh admin setelah vendor
  transfer bank — belum tersambung payment gateway. **Settlement & payout akhir
  sudah otomatis** (lihat bagian Guardrail); yang masih manual hanya konfirmasi
  dana masuk/keluar via transfer bank.
- **Verifikasi akun medsos creator** membuat token bio tapi belum ada pengecekan
  otomatis.

## Lisensi

Proyek ini dirilis di bawah [Lisensi MIT](LICENSE) — bebas dipakai, diubah, dan
didistribusikan, termasuk untuk keperluan komersial, selama pemberitahuan hak
cipta dan teks lisensinya ikut disertakan.

Aset di `public/` punya ketentuannya sendiri dan **tidak** tercakup lisensi ini
secara otomatis; sumber dan lisensi tiap aset dicatat di
`public/illustrations/README.md` dan `public/demo/README.md`.
