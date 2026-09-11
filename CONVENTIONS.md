# Konvensi Kode Kontem

Aturan wajib saat menambah atau mengubah file di proyek ini. Tujuannya satu:
siapa pun yang membuka repo ini enam bulan lagi bisa langsung menebak **di mana
sebuah kode seharusnya berada** tanpa menelusuri seluruh folder.

Dokumen ini mengatur *struktur dan cara menulis kode*. Untuk aturan visual
(warna, radius, tipografi), acuannya tetap [design.md](design.md).

---

## 1. Empat Lapisan & Arah Dependensi

Kode dibagi jadi empat lapisan. **Dependensi hanya boleh mengalir ke bawah.**

```
app/          ROUTING        — halaman, layout, server action
   │
   ├──────────────┐
   ▼              ▼
components/   domain/        TAMPILAN & LOGIKA BISNIS
   │              │
   └──────┬───────┘
          ▼
        lib/                 INFRASTRUKTUR
```

| Lapisan | Boleh mengimpor | Dilarang mengimpor |
| :--- | :--- | :--- |
| `app/` | semua lapisan | — |
| `components/` | `lib/`, dan server action dari `app/_actions/` | `domain/`, `app/<role>/` |
| `domain/` | `lib/` | `app/`, `components/` |
| `lib/` | hanya paket eksternal | ketiganya |

**Konsekuensi praktis:**

- **`components/ui/` wajib murni presentasional.** Tidak ada query, tidak ada
  `requireUser()`. Data masuk lewat props. Inilah yang membuat seluruh design
  system bisa diganti tanpa menyentuh logika.
- **`components/<fitur>/` boleh berupa Server Component yang query sendiri.**
  Ini pola Next.js yang sah dan mencegah prop drilling — `AppShell` mengambil
  jumlah notifikasi belum dibaca miliknya sendiri, alih-alih dioper dari
  tiga layout role. Syaratnya file itu diawali `import "server-only";` supaya
  batasnya ditegakkan compiler, bukan sekadar disiplin.
- Komponen boleh mengimpor server action **hanya** dari `app/_actions/`. Kalau
  sebuah komponen bersama butuh action yang masih tinggal di
  `app/<role>/actions.ts`, pindahkan action itu ke `app/_actions/` — karena
  faktanya action itu memang sudah lintas role.
- `domain/` tidak boleh mengimpor React atau apa pun dari `components/`.
- Kalau sebuah file bingung mau ditaruh di mana, hampir selalu jawabannya adalah
  file itu mengerjakan dua hal sekaligus dan perlu dipecah.

---

## 2. Menaruh File Baru

Jawab berurutan, berhenti di jawaban "ya" pertama:

| Pertanyaan | Taruh di |
| :--- | :--- |
| Ini halaman atau layout yang punya URL? | `src/app/<role>/<segmen>/page.tsx` |
| Ini komponen yang **hanya** dipakai satu halaman? | Sebelah halamannya, mis. `src/app/vendor/submissions/review-form.tsx` |
| Ini server action untuk satu role? | `src/app/<role>/actions.ts` |
| Ini server action yang dipakai lintas role? | `src/app/_actions/<nama>.ts` |
| Ini aturan bisnis (hitungan uang, status, validasi domain)? | `src/domain/<nama>.ts` |
| Ini komponen tampilan yang dipakai ≥ 2 halaman? | `src/components/ui/` atau `src/components/<fitur>/` |
| Ini koneksi ke sistem luar / helper umum? | `src/lib/<nama>.ts` |

**Jangan** membuat komponen di `components/` "untuk jaga-jaga nanti dipakai
ulang". Komponen naik ke `components/` **setelah** terbukti dipakai halaman
kedua, bukan sebelumnya.

---

## 3. Penamaan

| Jenis | Aturan | Contoh |
| :--- | :--- | :--- |
| Nama file | `kebab-case` | `review-form.tsx`, `page-header.tsx` |
| Komponen React | `PascalCase` | `ProgressBar`, `AppShell` |
| Fungsi & variabel | `camelCase` | `calculatePayouts`, `totalViews` |
| Server action | `camelCase` + akhiran `Action` | `settleCampaignAction` |
| Konstanta modul | `SCREAMING_SNAKE_CASE` | `COUNTABLE_STATUSES`, `FEE_RATE` |
| Tipe & enum | `PascalCase` | `PayoutLine`, `CampaignStatus` |

**Bahasa:** identifier kode dalam bahasa Inggris, sedangkan komentar, pesan
error, dan seluruh teks yang dilihat pengguna dalam bahasa Indonesia.

```ts
// ✅ benar
const menungguReview = submissions.filter((s) => s.status === "PENDING_REVIEW");
return { error: "Alasan penolakan wajib diisi minimal 10 karakter." };

// ❌ salah — pesan pengguna berbahasa Inggris
return { error: "Rejection reason is required." };
```

Pengecualian yang sudah berjalan: variabel lokal di dalam halaman boleh memakai
istilah Indonesia (`menungguReview`, `sisaHari`) karena lebih dekat dengan
bahasa domain. Yang penting **konsisten dalam satu file**.

---

## 4. Server Component vs Client Component

Default-nya **Server Component**. Tambahkan `"use client"` hanya kalau file itu
benar-benar butuh salah satu dari: `useState`, `useActionState`,
`useFormStatus`, event handler, atau API browser.

```tsx
// ✅ Halaman = Server Component: ambil data, lempar ke komponen sebagai props
export default async function VendorSubmissionsPage() {
  const user = await requireRole("VENDOR");
  const antrean = await db.submission.findMany({ ... });
  return <ReviewForm submissionId={antrean[0].id} />;
}
```

Aturan turunannya:
- Jangan menaruh `"use client"` di file yang mengekspor banyak komponen, karena
  seluruh isinya ikut terbawa ke bundle browser. Itu sebabnya `SubmitButton`
  punya filenya sendiri, terpisah dari `Button`.
- Jangan pernah mengimpor `@/lib/db` atau `@/lib/auth` dari Client Component.
  Keduanya sudah dipagari `import "server-only"`, jadi pelanggaran akan gagal
  saat build — perlakukan itu sebagai pengingat, bukan sebagai pengaman.
- Jangan melempar objek Prisma utuh sebagai props ke Client Component. Kirim
  hanya field yang dipakai.

---

## 5. Pola Server Action

Setiap server action wajib mengikuti urutan ini:

```ts
export async function contohAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Guard role — selalu paling awal
  const user = await requireRole("VENDOR");

  // 2. Validasi input dengan Zod
  const parsed = skema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // 3. Cek aturan bisnis, kembalikan error yang bisa dimengerti pengguna
  if (campaign.status !== "ACTIVE") {
    return { error: "Campaign ini sedang tidak menerima peserta." };
  }

  // 4. Tulis ke database — pakai transaksi kalau lebih dari satu tabel berubah
  await db.$transaction(async (tx) => { ... });

  // 5. Segarkan cache halaman terkait
  revalidatePath("/vendor/submissions");

  // 6. Kembalikan hasil
  return { success: "Submission disetujui." };
}
```

Aturan tegas:

1. **Guard role tidak boleh dilewati.** Server action adalah endpoint HTTP
   publik; tanpa `requireRole()` siapa pun bisa memanggilnya.
2. **Jangan percaya `formData`.** Semua input lewat Zod dulu. Id pun tetap
   diverifikasi kepemilikannya (`campaign.vendorId !== user.id` → tolak).
3. **Kembalikan error, jangan lempar exception,** untuk kesalahan yang bisa
   diperbaiki pengguna. Pesan error langsung ditampilkan di form.
4. **Satu transaksi untuk satu keputusan.** Kalau menyetujui submission juga
   mengubah participation, menaikkan trust score, dan membuat notifikasi,
   keempatnya masuk satu `db.$transaction`.
5. **Aksi yang mengubah status atau uang wajib menulis `AuditLog`.**
6. **Penolakan wajib beralasan** dan alasannya ikut tersimpan.

### Tipe `ActionState`

Semua action memakai bentuk yang sama supaya form bisa dipakai bergantian:

```ts
export type ActionState = { error?: string; success?: string };
```

Di sisi form, selalu pasangkan dengan `useActionState` dan `SubmitButton`:

```tsx
const [state, formAction] = useActionState<ActionState, FormData>(aksi, {});
```

`SubmitButton` mengunci dirinya selama aksi berjalan — ini yang mencegah
double-submit pada aksi yang tidak idempoten seperti klaim slot atau pencairan
payout. **Jangan** memakai `<Button type="submit">` biasa untuk server action.

---

## 6. Database

- Akses database **hanya** lewat `db` dari `@/lib/db`. Jangan membuat
  `PrismaClient` baru di mana pun kecuali `prisma/seed.ts`.
- Query hanya boleh ada di `app/**/page.tsx`, `app/**/actions.ts`, dan
  `domain/`. Tidak pernah di `components/`.
- Ambil seperlunya. Pakai `select` untuk query yang hanya butuh beberapa kolom,
  dan `_count` untuk menghitung relasi alih-alih menarik seluruh barisnya.
- Nilai uang disimpan sebagai `Int` dalam **rupiah penuh**, bukan sen dan bukan
  `Float`. Pembulatan dibereskan di `domain/payout.ts`.
- Setiap perubahan `schema.prisma` wajib disertai migrasi:
  ```bash
  pnpm exec prisma migrate dev --name deskripsi_singkat
  ```
  Jangan pernah mengubah file migrasi yang sudah pernah dijalankan.

### Menambah enum status

Menambah satu nilai enum berarti menyentuh tiga tempat sekaligus — kalau salah
satu terlewat, aplikasi akan gagal saat build atau menampilkan label kosong:

1. `prisma/schema.prisma` — tambahkan nilainya, lalu buat migrasi.
2. `src/lib/labels.ts` — tambahkan label bahasa Indonesia **dan** warna badge.
3. `prisma/seed.ts` — pertimbangkan menambah data demo untuk status baru itu.

`Record<StatusEnum, string>` di `labels.ts` sengaja dipakai supaya TypeScript
langsung protes kalau ada nilai enum yang belum punya label.

---

## 7. Komponen UI

- Halaman **selalu** mengimpor dari barrel `@/components/ui`, tidak pernah
  langsung ke `@/components/ui/button`. Ini yang membuat penyesuaian visual
  cukup dilakukan di dalam satu folder.
- Komponen di `ui/` tidak boleh melakukan query atau memanggil `requireUser()`.
  Kalau sebuah komponen butuh data, ia bukan komponen `ui/` — tempatnya di
  `components/<fitur>/` dan wajib ditandai `import "server-only";`.
- Komponen baru di `ui/` wajib didaftarkan di `src/components/ui/index.ts`.
- **Dilarang menulis warna hardcode.** Pakai token dari
  [globals.css](src/app/globals.css) lewat kelas Tailwind (`text-brand`,
  `bg-surface-muted`, `border-line`).

  ```tsx
  // ❌ salah
  <div className="bg-[#0ea5e9] text-white">

  // ✅ benar
  <div className="bg-brand text-white">
  ```

- Warna status tidak ditentukan di halaman, melainkan diambil dari peta `*Tone`
  di `labels.ts`:

  ```tsx
  <Badge tone={submissionStatusTone[submission.status]}>
    {submissionStatusLabel[submission.status]}
  </Badge>
  ```

- Setiap angka uang dan views dibungkus helper dari `@/lib/format`
  (`formatIDR`, `formatCompact`) dan diberi kelas `tabular` supaya kolom angka
  sejajar rapi.

### Geometri & elevasi

Nilai-nilai ini ditetapkan design.md bagian 2.3 dan **tidak boleh dikarang
sendiri per halaman**:

| Elemen | Radius | Bayangan |
| :--- | :--- | :--- |
| Tombol, badge, pill, tab | `rounded-full` | `shadow-brand` (primary) |
| Input, textarea, select | `rounded-xl` | — |
| Kartu standar | `rounded-2xl` | `shadow-card` |
| Kartu sorotan, banner, modal | `rounded-3xl` | `shadow-float` |

Kartu yang bisa diklik memakai prop `hover` pada `<Card>`, bukan kelas hover
buatan sendiri — supaya efek angkat 3px seragam di seluruh aplikasi.

### Warna status

Jangan menebak warna status di halaman. Ambil dari peta di `labels.ts`:
`campaignStatusTone`, `submissionStatusTone`, `participationStatusTone`,
`payoutStatusTone`, `verificationStatusTone`, dan `categoryTone`.

Menambah nilai `BadgeTone` baru berarti menambah barisnya di `toneClasses`
**dan** `toneIcons` pada `src/components/ui/tone.ts` — keduanya `Record<BadgeTone, string>`
sehingga TypeScript akan menolak build kalau ada yang terlewat.

---

## 8. Logika Bisnis (`domain/`)

Aturan main platform tinggal di sini, bukan berceceran di halaman.

- **`payout.ts` wajib tetap murni** — tanpa akses database, tanpa `Date.now()`,
  tanpa efek samping. Semua yang dibutuhkan masuk lewat parameter. Inilah yang
  membuatnya bisa diuji dan dipakai ulang untuk estimasi di layar creator.
- Perhitungan yang dipakai lebih dari satu role harus dipusatkan. Contohnya
  `getCampaignPerformance()` dipakai dashboard vendor, estimasi creator, dan
  pratinjau payout admin — sehingga ketiganya mustahil menampilkan angka
  berbeda.
- Jangan menduplikasi rumus uang di halaman. Kalau sebuah halaman butuh angka
  baru, tambahkan field di fungsi domain, jangan hitung ulang di JSX.

---

## 9. Komentar

Tulis komentar untuk menjelaskan **kenapa**, bukan **apa**. Kode sudah
menjelaskan apa yang terjadi.

```ts
// ❌ tidak berguna — mengulang isi kode
// ambil campaign dari database
const campaign = await db.campaign.findUnique({ ... });

// ✅ berguna — menjelaskan keputusan yang tidak terlihat dari kode
// Kuota dicek di dalam transaksi supaya dua creator yang menekan tombol
// bersamaan tidak sama-sama lolos saat slot tinggal satu.
await db.$transaction(async (tx) => { ... });
```

Yang **wajib** diberi komentar:
- Guardrail kepercayaan (kenapa sebuah aksi diblokir).
- Keputusan yang terlihat aneh tapi disengaja (mis. kenapa migrasi memakai
  `DIRECT_URL`, kenapa views yang turun otomatis di-flag).
- Rumus uang dan pembulatan.

---

## 10. Testing

Tidak semua kode perlu tes. Yang **wajib** ada tesnya:

- Setiap fungsi di `domain/` yang menghitung uang atau menentukan kelayakan.
- Setiap perbaikan bug pada perhitungan — tambahkan tes yang gagal sebelum
  perbaikan dan lolos sesudahnya.

Tes ditaruh bersebelahan dengan file yang diuji (`payout.ts` → `payout.test.ts`)
memakai test runner bawaan Node:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

test("vendor tidak pernah membayar lebih dari pool", () => {
  const hasil = calculatePayouts(entries, opts);
  assert.equal(hasil.totalDistributed, opts.budgetPool);
});
```

Nama tes ditulis sebagai kalimat yang menyatakan aturan bisnisnya, bukan nama
fungsinya. `"vendor tidak pernah membayar lebih dari pool"` jauh lebih berguna
daripada `"calculatePayouts works"`.

Jalankan dengan `pnpm test`.

---

## 11. Sebelum Menganggap Pekerjaan Selesai

Keempatnya harus lolos:

```bash
pnpm typecheck   # tidak ada error tipe
pnpm lint        # tidak ada peringatan ESLint
pnpm test        # semua tes lolos
pnpm build       # build produksi berhasil
```

Kalau menyentuh halaman, buka juga halamannya di browser. Build yang lolos tidak
menjamin halaman benar-benar render — kesalahan query baru muncul saat dijalankan.

---

## 12. Anti-Pattern

| Jangan | Lakukan |
| :--- | :--- |
| Server action tanpa `requireRole()` | Guard role di baris pertama |
| Memakai `formData.get()` langsung tanpa validasi | Validasi lewat skema Zod |
| Menghitung rupiah di dalam JSX | Pusatkan di `domain/`, tampilkan hasilnya saja |
| `bg-[#0ea5e9]` | `bg-brand` |
| `useEffect` untuk mengambil data | Ambil di Server Component |
| `any` untuk meredam error TypeScript | Perbaiki tipenya, atau `unknown` + penyempitan |
| `"use client"` di file berisi banyak komponen | Pisahkan bagian interaktifnya |
| Menambah nilai enum tanpa memperbarui `labels.ts` | Perbarui ketiga tempat di bagian 6 |
| Mengubah migrasi lama | Buat migrasi baru |
| Membuat `PrismaClient` baru | Impor `db` dari `@/lib/db` |
| Query database di dalam `components/ui/` | Oper lewat props, atau pindahkan ke `components/<fitur>/` |
| Komponen bersama mengimpor dari `app/<role>/actions.ts` | Pindahkan action-nya ke `app/_actions/` |
