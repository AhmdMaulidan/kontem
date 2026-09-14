import "server-only";
import { z } from "zod";

/**
 * Batas domain untuk fitur "automated agentic analyze".
 *
 * 14 tipe detector tetap (sama dengan engine Python). Campaign menyimpan
 * aturan (CampaignRule) yang menunjuk ke salah satu tipe ini + parameternya
 * sendiri. Laporan dibangkitkan HANYA dari aturan aktif -> campaign A dan B
 * menghasilkan struktur laporan yang berbeda.
 *
 * Layer ini TIDAK mengimpor React / komponen. Murni aturan bisnis + kontrak
 * engine (zod schema sebagai sumber kebenaran tunggal antara web dan engine).
 */

export const DETECTOR_TYPES = [
  "FACE_DETECTION",
  "VISUAL_DISCORD",
  "TEXT_OVERLAY",
  "URL_PRESENCE",
  "TEXT_PRESENCE",
  "HASHTAG_SEQUENCE",
  "NUMERIC",
  "NOT_CLICKBAIT",
  "NOT_AI",
  "EDITING_PRESENCE",
  "TEXT_RELEVANCE",
  "BOOL",
  "DATE",
  "HOOK_VALID",
] as const;

export type DetectorType = (typeof DETECTOR_TYPES)[number];

/** Petunjuk parameter per tipe detector (dokumentasi + UI builder). */
export const DETECTOR_META: Record<
  DetectorType,
  { label: string; description: string; paramHints: Record<string, string> }
> = {
  FACE_DETECTION: {
    label: "Ada wajah",
    description: "Cek keberadaan wajah via analisis skin-tone frame.",
    paramHints: { min_confidence: "0-1, ambang keyakinan wajah" },
  },
  VISUAL_DISCORD: {
    label: "Bukan layar Discord",
    description: "Tolak jika terlalu banyak piksel ungu Discord (#5865F2).",
    paramHints: { max_purple_ratio: "0-1, rasio maksimum piksel ungu" },
  },
  TEXT_OVERLAY: {
    label: "Overlay teks video",
    description: "Cek overlay teks persisten (edge density).",
    paramHints: {
      min_overlay_ratio: "ambang edge density",
      min_persistent_frames: "jumlah frame minimal",
    },
  },
  URL_PRESENCE: {
    label: "Ada URL CTA",
    description: "Cek URL tertentu ada di caption/transkrip.",
    paramHints: { allow: "array URL yang diizinkan", require: "wajib ada?" },
  },
  TEXT_PRESENCE: {
    label: "Kata kunci tertentu",
    description: "Cek keberadaan/ ketiadaan kata kunci.",
    paramHints: {
      keywords: "array kata kunci",
      must_contain: "true=harus ada, false=harus tidak ada",
    },
  },
  HASHTAG_SEQUENCE: {
    label: "Urutan hashtag",
    description: "Cek hashtag wajib ada di caption/transkrip.",
    paramHints: {
      required: "array hashtag wajib",
      all_required: "true=semua harus ada",
    },
  },
  NUMERIC: {
    label: "Metrik numerik",
    description: "Bandingkan field (mis. durasi) dengan ambang.",
    paramHints: { field: "field (durasi)", op: ">=,<=,>,<,==", value: "nilai ambang" },
  },
  NOT_CLICKBAIT: {
    label: "Bukan clickbait",
    description: "Tolak frasa clickbait.",
    paramHints: { banned: "array frasa terlarang" },
  },
  NOT_AI: {
    label: "Bukan AI-generated",
    description: "Tolak indikator konten AI (bukan 'ai clip').",
    paramHints: { indicators: "array indikator AI" },
  },
  EDITING_PRESENCE: {
    label: "Ada editing",
    description: "Cek adanya cut/transisi antar-frame.",
    paramHints: { min_cuts: "jumlah cut minimal" },
  },
  TEXT_RELEVANCE: {
    label: "Relevan topik",
    description: "Cek topik campaign muncul di teks.",
    paramHints: { topics: "array topik", min_matches: "kecocokan minimal" },
  },
  BOOL: {
    label: "Assert manual",
    description: "Cek yang dinyatakan admin (manual/trusted flag).",
    paramHints: { expect: "ekspektasi true/false", notes: "catatan" },
  },
  DATE: {
    label: "Jendela tanggal",
    description: "Cek upload_date dalam rentang.",
    paramHints: { after: "YYYY-MM-DD", before: "YYYY-MM-DD" },
  },
  HOOK_VALID: {
    label: "Hook valid",
    description: "Cek pembukaan kuat (transkrip/caption tak kosong).",
    paramHints: { within_sec: "detik", min_words: "kata minimal" },
  },
};

/** Satu rule yang dikirim ke engine (kontrak dengan Python API). */
export const RuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(DETECTOR_TYPES),
  enabled: z.boolean().default(true),
  weight: z.number().min(0).default(1),
  params: z.record(z.string(), z.unknown()).default({}),
  rationale: z.string().optional(),
});
export type Rule = z.infer<typeof RuleSchema>;

/** Request body ke engine: POST /api/analyze */
export const AnalyzeRequestSchema = z.object({
  url: z.string().url(),
  platform: z.enum(["auto", "tiktok", "instagram", "youtube"]).default("auto"),
  language: z.string().default("id"),
  caption: z.string().optional(),
  upload_date: z.string().optional(),
  campaign_id: z.string().optional(),
  campaign_name: z.string().optional(),
  rules: z.array(RuleSchema).min(1, "minimal satu rule"),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

/** Hasil per-rule dari engine. */
export const RuleResultSchema = z.object({
  rule_id: z.string(),
  label: z.string(),
  type: z.string(),
  passed: z.boolean(),
  value: z.unknown().nullable(),
  detail: z.string(),
  weight: z.number(),
});
export type RuleResult = z.infer<typeof RuleResultSchema>;

/** Respons engine: POST /api/analyze -> AnalysisReport */
export const AnalysisReportSchema = z.object({
  campaign_id: z.string().nullable().optional(),
  campaign_name: z.string().nullable().optional(),
  url: z.string(),
  platform: z.string(),
  duration_sec: z.number().nullable().optional(),
  transcript: z.string(),
  score: z.number(),
  passed_count: z.number(),
  failed_count: z.number(),
  total_enabled: z.number(),
  compliant: z.boolean(),
  results: z.array(RuleResultSchema),
  errors: z.array(z.string()),
  media_path: z.string().nullable().optional(),
});
export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;

/**
 * Konversi CampaignRule (row Prisma) menjadi Rule untuk engine.
 * `params` dan `ruleKey` dipetakan ke `id`/`params`.
 */
export function toEngineRule(rule: {
  ruleKey: string;
  label: string;
  type: DetectorType;
  enabled: boolean;
  weight: number;
  params: unknown;
  rationale?: string | null;
}): Rule {
  return {
    id: rule.ruleKey,
    label: rule.label,
    type: rule.type,
    enabled: rule.enabled,
    weight: rule.weight,
    params: (rule.params as Record<string, unknown>) ?? {},
    rationale: rule.rationale ?? undefined,
  };
}

/** Template GSTMC default (14 kriteria asli) untuk seeding rule campaign baru. */
export const GSTMC_DEFAULT_RULES: Omit<
  Rule,
  "id"
>[] = [
  { label: "Ada wajah", type: "FACE_DETECTION", enabled: true, weight: 1, params: { min_confidence: 0.5 } },
  { label: "Bukan layar Discord", type: "VISUAL_DISCORD", enabled: true, weight: 1, params: { max_purple_ratio: 0.02 } },
  { label: "Overlay teks MotionKlip", type: "TEXT_OVERLAY", enabled: true, weight: 1, params: { min_overlay_ratio: 0.01, min_persistent_frames: 5 } },
  { label: "Link CTA ada", type: "URL_PRESENCE", enabled: true, weight: 1, params: { allow: ["https://lv-inf.link/motionklipgst"], require: true } },
  { label: "Teks CTA ada", type: "TEXT_PRESENCE", enabled: true, weight: 1, params: { keywords: ["motionklip", "lv-inf.link"], must_contain: true } },
  { label: "Ada testimoni", type: "TEXT_PRESENCE", enabled: true, weight: 1, params: { keywords: ["testimoni", "berasa", "mantap"], must_contain: false } },
  { label: "Ada editing", type: "EDITING_PRESENCE", enabled: true, weight: 1, params: { min_cuts: 3 } },
  { label: "Durasi minimal 15 detik", type: "NUMERIC", enabled: true, weight: 1, params: { field: "duration", op: ">=", value: 15 } },
  { label: "Hook valid", type: "HOOK_VALID", enabled: true, weight: 1, params: { within_sec: 5, min_words: 3 } },
  { label: "Bukan clickbait", type: "NOT_CLICKBAIT", enabled: true, weight: 1, params: { banned: ["you won't believe", "shocking", "100% free"] } },
  { label: "Bukan AI-generated", type: "NOT_AI", enabled: true, weight: 1, params: { indicators: ["ai generated", "made with ai"] } },
  { label: "Hashtag wajib", type: "HASHTAG_SEQUENCE", enabled: true, weight: 1, params: { required: ["#GangstarMirageCity", "#GSTMC", "#bebasbarbarbos", "#motionklip", "#ezklip"], all_required: true } },
  { label: "Konten original", type: "BOOL", enabled: true, weight: 1, params: { expect: true, notes: "assert original (manual/trusted flag)" } },
  { label: "Caption relevan", type: "TEXT_RELEVANCE", enabled: true, weight: 1, params: { topics: ["motionklip", "gstmc", "gangstar"], min_matches: 1 } },
];
