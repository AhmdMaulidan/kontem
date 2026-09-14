"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const ENGINE_URL = process.env.ENGINE_URL;
const ENGINE_API_KEY = process.env.ENGINE_API_KEY;
const ENGINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit — analisis video butuh waktu

export type AnalyzeState = {
  error?: string;
  success?: boolean;
  analysisId?: string;
};

export type BriefState = { error?: string; success?: string };

export type DecisionState = { error?: string; success?: string };

function isValidVideoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)(tiktok\.com|instagram\.com|youtube\.com)$/i.test(host);
  } catch {
    return false;
  }
}

export async function analyzeUrlAction(
  _prev: AnalyzeState,
  formData: FormData,
): Promise<AnalyzeState> {
  await requireRole("ADMIN");
  const url = String(formData.get("url") ?? "").trim();
  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!url) return { error: "URL video wajib diisi." };
  if (!isValidVideoUrl(url)) {
    return { error: "URL harus dari TikTok, Instagram, atau YouTube." };
  }
  if (!campaignId) return { error: "Pilih campaign dulu." };

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { error: "Campaign tidak ditemukan." };
  if (!campaign.brief.trim()) {
    return {
      error:
        "Campaign ini belum punya brief. Isi brief dulu di halaman Approval Campaign.",
    };
  }

  if (!ENGINE_URL) {
    return { error: "ENGINE_URL belum diset di .env — engine tidak bisa dipanggil." };
  }

  // Record PROCESSING disimpan dulu supaya kalau engine hang/crash tetap ada
  // jejaknya dan status bisa ditandai FAILED.
  const analysis = await db.videoAnalysis.create({
    data: {
      sourceUrl: url,
      campaignId,
      brief: campaign.brief,
      status: "PROCESSING",
      alasan: [] as Prisma.InputJsonValue,
      interpretedRules: [] as Prisma.InputJsonValue,
      results: {} as Prisma.InputJsonValue,
    },
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

    const res = await fetch(`${ENGINE_URL}/api/analyze/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENGINE_API_KEY ? { "x-api-key": ENGINE_API_KEY } : {}),
      },
      body: JSON.stringify({
        url,
        brief: campaign.brief,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        typeof errBody?.detail === "string" ? errBody.detail : `Engine error ${res.status}`,
      );
    }

    const data = await res.json();

    await db.videoAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "COMPLETED",
        verdict: data.verdict,
        score: typeof data.score === "number" ? data.score : null,
        alasan: (Array.isArray(data.alasan) ? data.alasan : []) as Prisma.InputJsonValue,
        interpretedRules: (Array.isArray(data.interpreted_rules)
          ? data.interpreted_rules
          : []) as Prisma.InputJsonValue,
        transcript: typeof data.transcript === "string" ? data.transcript : null,
        durationSec:
          typeof data.duration_sec === "number" ? Math.round(data.duration_sec) : null,
        results: data as Prisma.InputJsonValue,
      },
    });

    revalidatePath("/admin/analyzer");
    revalidatePath(`/admin/analyses/${analysis.id}`);
    return { success: true, analysisId: analysis.id };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const message = aborted
      ? "Analisis timeout (>10 menit). Engine tidak merespons. Silakan coba lagi."
      : "Engine gagal: " + (err instanceof Error ? err.message : "Unknown error");

    await db.videoAnalysis.update({
      where: { id: analysis.id },
      data: { status: "FAILED", alasan: [message] as Prisma.InputJsonValue },
    });

    revalidatePath("/admin/analyzer");
    return {
      error: "Analisis gagal. Cek URL atau coba lagi nanti.",
      analysisId: analysis.id,
    };
  }
}

export async function setHumanDecisionAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  await requireRole("ADMIN");
  const analysisId = String(formData.get("analysisId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (decision !== "diterima" && decision !== "ditolak") {
    return { error: "Keputusan tidak valid." };
  }

  const analysis = await db.videoAnalysis.findUnique({ where: { id: analysisId } });
  if (!analysis) return { error: "Analisis tidak ditemukan." };
  if (analysis.humanDecision) {
    return { error: "Analisis ini sudah diberi keputusan admin." };
  }

  await db.videoAnalysis.update({
    where: { id: analysisId },
    data: { humanDecision: decision },
  });

  revalidatePath(`/admin/analyses/${analysisId}`);
  revalidatePath("/admin/analyzer");
  return { success: "Keputusan admin tersimpan." };
}

export async function saveCampaignBriefAction(
  _prev: BriefState,
  formData: FormData,
): Promise<BriefState> {
  await requireRole("ADMIN");
  const campaignId = String(formData.get("campaignId") ?? "");
  const brief = String(formData.get("brief") ?? "").trim();

  if (!campaignId) return { error: "Campaign tidak ditemukan." };

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { error: "Campaign tidak ditemukan." };

  await db.campaign.update({ where: { id: campaignId }, data: { brief } });

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/analyzer");
  return { success: "Brief tersimpan." };
}
