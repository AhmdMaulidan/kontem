import "server-only";
import { AnalyzeRequestSchema, AnalysisReportSchema, type AnalyzeRequest, type AnalysisReport } from "@/domain/analyze";

/**
 * Klien ke engine analisis Python (FastAPI). Engine berjalan terpisah dari
 * Next.js (lihat campaign-clip/engine). Web mengirim URL + rule campaign, engine
 * mengembalikan laporan kepatuhan dinamis.
 *
 * Konfigurasi via env:
 *   ANALYZE_ENGINE_URL  (default http://localhost:8000)
 *   ANALYZE_ENGINE_TOKEN (opsional, diheader x-api-key)
 */

const ENGINE_URL = process.env.ANALYZE_ENGINE_URL ?? "http://localhost:8000";
const ENGINE_TOKEN = process.env.ANALYZE_ENGINE_TOKEN;

export async function runAnalysis(input: AnalyzeRequest): Promise<AnalysisReport> {
  const parsed = AnalyzeRequestSchema.parse(input);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ENGINE_TOKEN) headers["x-api-key"] = ENGINE_TOKEN;

  const res = await fetch(`${ENGINE_URL}/api/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify(parsed),
    // Analisis video bisa lama (download + whisper). Beri waktu panjang.
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Engine ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  return AnalysisReportSchema.parse(json);
}

export async function getEngineDetectors(): Promise<unknown> {
  const res = await fetch(`${ENGINE_URL}/api/detectors`, {
    headers: ENGINE_TOKEN ? { "x-api-key": ENGINE_TOKEN } : {},
  });
  if (!res.ok) throw new Error(`Engine detectors ${res.status}`);
  return res.json();
}

export function engineHealthy(): Promise<boolean> {
  return fetch(`${ENGINE_URL}/healthz`).then((r) => r.ok).catch(() => false);
}
