# Instruksi Agent Web — Integrasi Engine Compliance (kontem)

Kamu mengerjakan BAGIAN WEB fitur compliance analyzer di project kontem.
Dokumen ini self-contained — kamu hanya perlu repo + dokumen ini.
Kamu TIDAK perlu tahu cara kerja engine di belakang.

## 0. KONSEP DASAR (dari sudut pandang web)

Kamu = sisi web (Next.js + Prisma + Postgres).
Engine = service HTTP eksternal. Kamu POST JSON → dia balikin JSON.

Alur:
1. Admin campaign nulis BRIEF (aturan teks bebas) di 1 textarea
2. User submit link video TikTok/Instagram/YouTube
3. Web kirim `{ url, brief }` ke engine → tunggu 1-3 menit
4. Engine balikin `{ verdict, alasan, score, interpreted_rules, transcript, duration_sec }`
5. Web simpan + tampilkan hasil ke user

3 kemungkinan verdict:
- **diterima** — hijau, semua aturan terpenuhi
- **ditolak** — merah, ada aturan wajib yang dilanggar
- **perlu_verifikasi** — kuning, ambigu/perlu cek manual admin

Web TIDAK BOLEH:
- Parse / pahami isi brief
- Bangun form kriteria / dropdown / CRUD rules
- Hardcode kriteria campaign apapun
- Panggil engine dari client browser (API key harus di server)

## 1. KONTRAK API ENGINE — APA YANG KAMU KIRIM

Hanya satu endpoint: **POST {ENGINE_URL}/api/analyze**

### Request body (JSON)

```json
{
  "url": "https://www.tiktok.com/@user/video/123456",
  "brief": "1. Ada kata ikan\n2. Ada kata seafood bakaran\n3. Perlu ada watermark",
  "platform": "auto",
  "language": "id",
  "caption": "Caption postingan (opsional)",
  "campaign_id": "cm_xxx",
  "settings": {
    "review_threshold": 70,
    "min_confidence": 0.5
  }
}
```

### Penjelasan field-by-field

| Field | Wajib? | Tipe | Keterangan |
|-------|--------|------|------------|
| url | YA | string | URL video TikTok/Instagram/YouTube. Validasi: domain harus tiktok.com / instagram.com / youtube.com. Kalau bukan → tolak, JANGAN panggil engine |
| brief | YA | string | Teks BEBAS aturan campaign. Maks 5000 karakter. Bisa format "1. ... 2. ..." atau paragraf bebas. Kamu cuma simpan + kirim — jangan di-parse |
| platform | tidak | "auto" / "tiktok" / "instagram" / "youtube" | Default "auto" |
| language | tidak | string | Kode bahasa, default "id" |
| caption | tidak | string | Teks caption postingan asli (kalau ada) |
| campaign_id | tidak | string | ID campaign di DB kamu, buat tracing |
| settings | tidak | object | Opsional. Kalau tidak dikirim, engine pakai default sendiri |

### Contoh brief yang valid (semua ini valid, jangan divalidasi isinya)

```
1. Ada kata promo
2. Ada kata diskon
3. Durasi minimal 30 detik
```

```
Wajib menyebutkan kata "gratis ongkir" dan menampilkan produk minimal 10 detik
```

```
- harus ada wajah
- harus ada suara narator
- jangan clickbait
- hashtag #iklanwajib
```

Besok brief ganti, kamu tetap kirim apa adanya. Engine yang menyesuaikan.

## 2. KONTRAK API ENGINE — APA YANG KAMU TERIMA

Engine SELALU balikin JSON. Ini spesifikasi field-by-field.

### Struktur response lengkap

```json
{
  "verdict": "diterima",
  "score": 96.0,
  "alasan": ["..."],
  "interpreted_rules": [
    {
      "source": "1. Ada kata ikan",
      "checks": [
        {
          "type": "text_presence",
          "label": "Kata 'ikan' ada di ucapan/caption",
          "impact": "critical",
          "passed": true,
          "detail": "ditemukan di transkrip: '...ikan bakar...'"
        }
      ]
    }
  ],
  "transcript": "Halo semuanya kali ini kita...",
  "duration_sec": 45.2,
  "errors": []
}
```

### Penjelasan setiap field

| Field | Selalu ada? | Tipe | Keterangan |
|-------|-------------|------|------------|
| verdict | YA | "diterima" / "ditolak" / "perlu_verifikasi" | Keputusan akhir. HANYA 3 nilai ini |
| score | YA | number (0-100) | Skor hasil evaluasi |
| alasan | YA | string[] | Array alasan, selalu minimal 1 item. SETIAP alasan menyertakan nomor aturan asal (contoh: "Aturan 1 gagal: ..."). WAJIB ditampilkan ke user |
| interpreted_rules | YA | object[] | Bukti pemahaman engine terhadap brief. Tampilkan ke admin agar bisa koreksi kalau engine salah paham. Struktur: source (teks asli brief baris itu) + checks (array hasil deteksi per check) |
| interpreted_rules[].source | YA | string | Teks asli 1 baris brief (mis. "1. Ada kata ikan") |
| interpreted_rules[].checks | YA | object[] | Array hasil deteksi untuk baris brief tersebut |
| interpreted_rules[].checks[].type | YA | string | Tipe deteksi (informasi saja, abaikan) |
| interpreted_rules[].checks[].label | YA | string | Deskripsi apa yang dicek ("Kata 'ikan' ada di...") |
| interpreted_rules[].checks[].impact | YA | "critical" / "normal" / "info" | Dampak kegagalan: critical = wajib, normal = ambigu, info = catatan |
| interpreted_rules[].checks[].passed | YA | boolean | true = lolos, false = gagal |
| interpreted_rules[].checks[].detail | YA | string | Penjelasan kenapa lolos/gagal. Bisa kosong "" |
| transcript | TIDAK | string? | Teks hasil transkrip suara video. null kalau gagal transkrip |
| duration_sec | TIDAK | number? | Durasi video dalam detik. null kalau gagal baca |
| errors | YA | string[] | Error teknis (mis. "gagal download"). Biasanya array kosong [] |

### CONTOH RESPONSE LENGKAP PER VERDICT

#### DITERIMA
```json
{
  "verdict": "diterima",
  "score": 96.0,
  "alasan": ["Semua 3 aturan terpenuhi (skor 96/100)"],
  "interpreted_rules": [
    {
      "source": "1. Ada kata ikan",
      "checks": [
        { "type": "text_presence", "label": "Kata 'ikan' ada di ucapan/caption", "impact": "critical", "passed": true, "detail": "ditemukan di transkrip: '...ikan bakar...'" }
      ]
    },
    {
      "source": "2. Ada kata seafood bakaran",
      "checks": [
        { "type": "text_presence", "label": "Kata 'seafood' / 'bakaran' ada", "impact": "normal", "passed": true, "detail": "ditemukan: 'seafood bakaran'" }
      ]
    },
    {
      "source": "3. Perlu ada watermark",
      "checks": [
        { "type": "text_overlay", "label": "Watermark/teks overlay terdeteksi", "impact": "normal", "passed": true, "detail": "overlay konsisten terdeteksi" }
      ]
    }
  ],
  "transcript": "Halo semuanya kali ini kita bakal masak ikan bakar seafood...",
  "duration_sec": 45.2,
  "errors": []
}
```

#### DITOLAK
```json
{
  "verdict": "ditolak",
  "score": 33.3,
  "alasan": [
    "Aturan 1 gagal: kata 'ikan' tidak ditemukan di caption maupun ucapan video",
    "Aturan 3 gagal: watermark tidak terdeteksi di video"
  ],
  "interpreted_rules": [
    {
      "source": "1. Ada kata ikan",
      "checks": [
        { "type": "text_presence", "label": "Kata 'ikan' ada di ucapan/caption", "impact": "critical", "passed": false, "detail": "tidak ditemukan" }
      ]
    },
    {
      "source": "2. Ada kata seafood bakaran",
      "checks": [
        { "type": "text_presence", "label": "Kata 'seafood' / 'bakaran' ada", "impact": "normal", "passed": true, "detail": "ditemukan: 'seafood bakaran'" }
      ]
    },
    {
      "source": "3. Perlu ada watermark",
      "checks": [
        { "type": "text_overlay", "label": "Watermark/teks overlay terdeteksi", "impact": "critical", "passed": false, "detail": "tidak ada overlay terdeteksi" }
      ]
    }
  ],
  "transcript": "Halo guys kali ini kita di restoran seafood...",
  "duration_sec": 23.0,
  "errors": []
}
```

#### PERLU VERIFIKASI
```json
{
  "verdict": "perlu_verifikasi",
  "score": 68.5,
  "alasan": [
    "Aturan 2 lolos tapi confidence rendah (0.42) - kata 'bakaran' terbaca samar, cek manual",
    "Aturan 3 (watermark) tidak bisa dicek otomatis - mohon verifikasi manual"
  ],
  "interpreted_rules": [
    {
      "source": "1. Ada kata ikan",
      "checks": [
        { "type": "text_presence", "label": "Kata 'ikan' ada di ucapan/caption", "impact": "critical", "passed": true, "detail": "ditemukan di transkrip" }
      ]
    },
    {
      "source": "2. Ada kata seafood bakaran",
      "checks": [
        { "type": "text_presence", "label": "Kata 'seafood' / 'bakaran' ada", "impact": "normal", "passed": true, "detail": "'seafood' ditemukan, 'bakaran' confidence rendah (0.42)" }
      ]
    },
    {
      "source": "3. Perlu ada watermark",
      "checks": [
        { "type": "text_overlay", "label": "Watermark/teks overlay terdeteksi", "impact": "normal", "passed": false, "detail": "tidak bisa dicek otomatis, cocokkan manual" }
      ]
    }
  ],
  "transcript": "...",
  "duration_sec": 31.0,
  "errors": []
}
```

## 3. ERROR HANDLING (3 skenario)

### Skenario 1: HTTP 4xx dari engine
Engine balikin status 4xx + body `{ "detail": "pesan error" }`.
→ Tangkap error, tampilkan pesan ke user. JANGAN simpan ke DB. Biarkan user perbaiki input.

### Skenario 2: HTTP 5xx / network error / timeout
Engine mati, network putus, atau request > 10 menit.
→ Update status VideoAnalysis ke FAILED, simpan alasan: "Engine gagal menganalisis video. Silakan coba lagi." Tampilkan halaman hasil dengan badge abu-abu "GAGAL" + tombol "Analisis Ulang".

### Skenario 3: HTTP 200 tapi errors[] tidak kosong
Response `{ verdict: "perlu_verifikasi", errors: ["gagal download audio"], ... }`
→ Tetap simpan semua data seperti biasa. Tampilkan errors di halaman hasil.

## 4. DATABASE — SKEMA PRISMA

Ini model yang perlu kamu buat/migrasi. Pastikan field brief ada di Campaign.

```prisma
model Campaign {
  id          String   @id @default(cuid())
  name        String
  description String?
  brief       String   @default("")    // <-- FIELD BARU: aturan teks bebas (textarea)
  // ... field lain yang SUDAH ADA (jangan dihapus)
  analyses    VideoAnalysis[]
}

enum AnalysisVerdict {
  diterima
  ditolak
  perlu_verifikasi
}

enum AnalysisStatus {
  PROCESSING
  COMPLETED
  FAILED
}

model VideoAnalysis {
  id               String           @id @default(cuid())
  campaignId       String?
  campaign         Campaign?        @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  sourceUrl        String
  brief            String           // SALINAN brief saat submit (buat audit: kalau brief campaign diubah nanti, hasil analisis lama tetap bisa dijelaskan)
  interpretedRules Json             // SALINAN response.interpreted_rules mentah
  verdict          AnalysisVerdict? // null selama PROCESSING
  status           AnalysisStatus   @default(PROCESSING)
  alasan           Json             // string[] dari response.alasan
  score            Float?
  transcript       String?
  durationSec      Int?
  results          Json             // SELURUH response engine disimpan mentah
  humanDecision    AnalysisVerdict? // diisi admin saat review manual (perlu_verifikasi / FAILED)
  createdAt        DateTime         @default(now())

  @@map("video_analyses")
}
```

### Catatan Prisma (verified, jangan diulang)
- Prisma 7 + Next 16: client di `src/generated/prisma`, URL di `prisma.config.ts` (DIRECT_URL ?? DATABASE_URL)
- Field Json wajib di-cast: `alasan: [] as Prisma.InputJsonValue` saat create
- `onDelete: SetNull` di campaignId — kalau campaign dihapus, analisis tetap ada

## 5. SERVER ACTION (contoh implementasi)

```typescript
// src/app/admin/actions.ts
"use server";

const ENGINE_URL = process.env.ENGINE_URL!;
const ENGINE_API_KEY = process.env.ENGINE_API_KEY;

function isValidVideoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)(tiktok\.com|instagram\.com|youtube\.com)$/i.test(host);
  } catch { return false; }
}

export async function analyzeUrlAction(formData: FormData) {
  const url = formData.get("url") as string;
  const campaignId = formData.get("campaignId") as string;

  // 1. Validasi URL — tolak sebelum panggil engine
  if (!isValidVideoUrl(url)) {
    return { error: "URL harus dari TikTok, Instagram, atau YouTube" };
  }

  // 2. Ambil brief campaign
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign?.brief || campaign.brief.trim() === "") {
    return { error: "Campaign ini belum punya brief. Isi brief dulu di halaman edit campaign." };
  }

  // 3. Buat record PROCESSING
  const analysis = await prisma.videoAnalysis.create({
    data: {
      sourceUrl: url,
      campaignId,
      brief: campaign.brief,
      status: "PROCESSING",
      alasan: [] as Prisma.InputJsonValue,
      interpretedRules: [] as Prisma.InputJsonValue,
      results: [] as Prisma.InputJsonValue,
    },
  });

  // 4. Panggil engine
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 menit

    const res = await fetch(`${ENGINE_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENGINE_API_KEY ? { "x-api-key": ENGINE_API_KEY } : {}),
      },
      body: JSON.stringify({
        url,
        brief: campaign.brief,
        platform: "auto",
        language: "id",
        campaign_id: campaignId,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `Engine error ${res.status}`);
    }

    const data = await res.json();

    // 5. Update COMPLETED
    await prisma.videoAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "COMPLETED",
        verdict: data.verdict,
        score: data.score,
        alasan: data.alasan as Prisma.InputJsonValue,
        interpretedRules: data.interpreted_rules as Prisma.InputJsonValue,
        transcript: data.transcript ?? null,
        durationSec: data.duration_sec ?? null,
        results: data as Prisma.InputJsonValue,
      },
    });

    revalidatePath("/admin");
    return { success: true, analysisId: analysis.id };

  } catch (err: any) {
    // 6. FAILED — jangan crash
    if (err.name === "AbortError") {
      await prisma.videoAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "FAILED",
          alasan: ["Analisis timeout (>10 menit). Engine tidak merespons. Silakan coba lagi."] as Prisma.InputJsonValue,
        },
      });
    } else {
      await prisma.videoAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "FAILED",
          alasan: ["Engine gagal: " + (err.message || "Unknown error")] as Prisma.InputJsonValue,
        },
      });
    }
    revalidatePath("/admin");
    return { error: "Analisis gagal. Cek URL atau coba lagi nanti.", analysisId: analysis.id };
  }
}

export async function setHumanDecisionAction(analysisId: string, decision: "diterima" | "ditolak") {
  await prisma.videoAnalysis.update({
    where: { id: analysisId },
    data: { humanDecision: decision },
  });
  revalidatePath("/admin");
}
```

## 6. HALAMAN YANG HARUS KAMU BUAT

### 6.1 Edit brief campaign
- Route: halaman edit campaign yang sudah ada
- Tambah **1 textarea** untuk field `brief`
- Placeholder: `1. Ada kata promo\n2. Ada kata diskon\n3. Durasi minimal 30 detik`
- Tombol simpan → upsert `campaign.brief`
- JANGAN tambah dropdown/select/CRUD rules apapun. HANYA textarea.

### 6.2 Halaman submit analisis
- Form: input text URL + dropdown pilih campaign (yang sudah punya brief)
- Tombol "Analisis" → panggil `analyzeUrlAction`
- Setelah sukses → redirect ke halaman hasil (`/admin/analyses/[id]`)

### 6.3 Halaman hasil analisis
Route: `/admin/analyses/[id]`

Wajib menampilkan:

1. **Badge verdict besar**
   - `diterima` → badge hijau "DITERIMA"
   - `ditolak` → badge merah "DITOLAK"
   - `perlu_verifikasi` → badge kuning "PERLU VERIFIKASI"
   - `null` (PROCESSING) → spinner "Menganalisis..."
   - status FAILED → badge abu-abu "GAGAL"
   - Kalau `humanDecision` terisi → badge kecil tambahan "Keputusan Admin: [DITERIMA/DITOLAK]"

2. **Info dasar**: skor (X/100), durasi video (X detik), link sumber (clickable)

3. **Kartu "Alasan"**
   - List semua item dari field `alasan`. WAJIB, jangan disembunyikan.
   - 1 item = 1 baris. Nomor aturan sudah ada di dalam teks (dari engine).

4. **Kartu "Pemahaman Engine terhadap Brief"**
   - Dari `interpreted_rules`. Per aturan: tampilkan `source` (teks brief) + list check.
   - Setiap check: label + ikon ✓/✗ + detail.
   - Ini biar admin bisa lihat: "oh, engine memahami brief-ku seperti ini."
   - Kalau engine salah tafsir → admin edit brief → klik "Analisis Ulang".

5. **Transkrip** (collapsible)
   - Dari field `transcript`.
   - Kalau null → tampilkan "Transkrip tidak tersedia".

6. **Tombol review manual**
   - HANYA muncul kalau `verdict === "perlu_verifikasi"` ATAU `status === "FAILED"`.
   - Dua tombol: "Terima" dan "Tolak" → panggil `setHumanDecisionAction`.
   - Setelah diputus → tombol hilang, tampilkan state keputusan.

7. **Tombol "Analisis Ulang"**
   - Selalu tampil. Kembali ke halaman submit dengan URL + campaign terisi.

### 6.4 Daftar analisis
- Tabel: tanggal, URL (pendek), campaign, badge verdict, skor, status, keputusan admin.
- Klik baris → halaman detail.

## 7. ENV YANG DIBUTUHKAN

```env
ENGINE_URL=http://localhost:8000
ENGINE_API_KEY=
DATABASE_URL=postgres://...
DIRECT_URL=postgres://...
```

- `ENGINE_URL`: URL engine compliance. http://localhost:8000 untuk development.
- `ENGINE_API_KEY`: kosongkan kalau engine development tanpa auth.
- JANGAN ekspos `ENGINE_API_KEY` ke client bundle.

## 8. YANG TIDAK BOLEH KAMU LAKUKAN (hard constraints)

- [!] JANGAN membangun CRUD rules / form kriteria / dropdown tipe detector. Brief cuma textarea.
- [!] JANGAN menginterpretasi isi brief (parsing "ada kata X", "harus ada Y"). Itu kerjaan engine.
- [!] JANGAN hardcode kriteria campaign apapun (hashtag, link, durasi minimal).
- [!] JANGAN panggil engine dari client-side fetch. Harus lewat server action.
- [!] JANGAN timpa field `verdict`/`alasan`/`results` dengan keputusan manual. `humanDecision` field terpisah.
- [!] JANGAN crash/throw saat engine error. Selalu update status FAILED + simpan alasan.
- [!] JANGAN hapus field yang sudah ada di model Campaign. Cuma TAMBAH `brief`.
- [!] JANGAN berhenti dengan plan. Uji beneran: dev server, isi brief, submit URL nyata, lihat verdict.

## 9. DEFINISI SELESAI (acceptance criteria)

- [ ] 1. Schema Prisma sudah di-migrate: Campaign.brief + VideoAnalysis lengkap
- [ ] 2. Halaman campaign: edit brief (textarea) → simpan ke DB
- [ ] 3. Submit URL valid → VideoAnalysis PROCESSING → COMPLETED dengan verdict + alasan + interpreted_rules
- [ ] 4. Halaman hasil: badge 3 warna + daftar alasan + kartu interpreted_rules + skor + durasi + transkrip
- [ ] 5. Review manual: tombol Terima/Tolak untuk perlu_verifikasi/FAILED, simpan humanDecision, tombol nonaktif setelahnya
- [ ] 6. URL invalid (bukan tiktok/ig/yt) → tolak sebelum panggil engine, pesan jelas
- [ ] 7. Engine error/network error → status FAILED + pesan tampil, bukan 500 mentah
- [ ] 8. Semua dibuktikan dengan hasil nyata (jalanin dev server, submit, screenshot)

## 10. PRIORITAS PENGERJAAN

1. Schema DB (Prisma migrate)
2. `src/lib/analyze-client.ts` (fetch wrapper)
3. Server actions (`analyzeUrlAction`, `setHumanDecisionAction`)
4. Halaman hasil analisis
5. Halaman edit campaign (textarea brief)
6. Halaman submit + daftar analisis
