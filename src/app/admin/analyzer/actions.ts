"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { DETECTOR_TYPES, GSTMC_DEFAULT_RULES, toEngineRule } from "@/domain/analyze";
import { runAnalysis } from "@/lib/analyze-client";

export type ActionState = { error?: string; success?: string };

// ---------------------------------------------------------------- rule builder

const RuleInputSchema = z.object({
  campaignId: z.string().min(1),
  ruleKey: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(DETECTOR_TYPES),
  enabled: z.boolean(),
  weight: z.number().min(0),
  params: z.string().default("{}"), // JSON string dari textarea/form hidden
  rationale: z.string().optional(),
});

/** Simpan (upsert) satu rule campaign. Dipakai builder dinamis admin. */
export async function saveCampaignRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("ADMIN");

  const raw = {
    campaignId: String(formData.get("campaignId") ?? ""),
    ruleKey: String(formData.get("ruleKey") ?? ""),
    label: String(formData.get("label") ?? ""),
    type: String(formData.get("type") ?? ""),
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
    weight: Number(formData.get("weight") ?? 1),
    params: String(formData.get("params") ?? "{}"),
    rationale: String(formData.get("rationale") ?? ""),
  };

  const parsed = RuleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  let params: Record<string, unknown>;
  try {
    params = JSON.parse(parsed.data.params || "{}");
  } catch {
    return { error: "Params bukan JSON valid." };
  }

  await db.campaignRule.upsert({
    where: { campaignId_ruleKey: { campaignId: parsed.data.campaignId, ruleKey: parsed.data.ruleKey } },
    create: {
      campaignId: parsed.data.campaignId,
      ruleKey: parsed.data.ruleKey,
      label: parsed.data.label,
      type: parsed.data.type,
      enabled: parsed.data.enabled,
      weight: parsed.data.weight,
      params: params as Prisma.InputJsonValue,
      rationale: parsed.data.rationale || null,
    },
    update: {
      label: parsed.data.label,
      type: parsed.data.type,
      enabled: parsed.data.enabled,
      weight: parsed.data.weight,
      params: params as Prisma.InputJsonValue,
      rationale: parsed.data.rationale || null,
    },
  });

  revalidatePath(`/admin/analyzer/${parsed.data.campaignId}`);
  return { success: `Rule "${parsed.data.label}" disimpan.` };
}

/** Hapus satu rule. */
export async function deleteCampaignRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("ADMIN");
  const ruleId = String(formData.get("ruleId") ?? "");
  if (!ruleId) return { error: "ruleId kosong." };
  await db.campaignRule.delete({ where: { id: ruleId } }).catch(() => null);
  revalidatePath("/admin/analyzer");
  return { success: "Rule dihapus." };
}

/** Seed campaign dengan 14 rule GSTMC default. */
export async function seedDefaultRulesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("ADMIN");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!campaignId) return { error: "campaignId kosong." };

  await db.campaignRule.createMany({
    data: GSTMC_DEFAULT_RULES.map((r) => ({
      campaignId,
      ruleKey: r.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      label: r.label,
      type: r.type,
      enabled: r.enabled,
      weight: r.weight,
      params: r.params as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });

  revalidatePath(`/admin/analyzer/${campaignId}`);
  return { success: "14 rule GSTMC default ditambahkan." };
}

// ---------------------------------------------------------------- run analysis

/**
 * Jalankan analisis ke engine untuk URL (atau Submission) lalu simpan laporan.
 * Ini "automated agentic analyze": rule diambil dari campaign yang aktif.
 */
export async function analyzeUrlAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("ADMIN");

  const campaignId = String(formData.get("campaignId") ?? "") || null;
  let url = String(formData.get("url") ?? "").trim();
  const submissionId = String(formData.get("submissionId") ?? "") || null;
  let caption = String(formData.get("caption") ?? "") || null;
  const platform = String(formData.get("platform") ?? "auto") || "auto";

  if (!url && !submissionId) return { error: "URL atau submission wajib diisi." };

  // Tentukan campaign + rule yang dipakai.
  let effectiveCampaignId = campaignId;
  if (!effectiveCampaignId && submissionId) {
    const sub = await db.submission.findUnique({
      where: { id: submissionId },
      select: { campaignId: true, contentUrl: true, caption: true, platform: true },
    });
    if (sub) {
      effectiveCampaignId = sub.campaignId;
      if (!url) url = sub.contentUrl;
      if (!caption) caption = sub.caption;
    }
  }

  const rules = effectiveCampaignId
    ? await db.campaignRule.findMany({ where: { campaignId: effectiveCampaignId } })
    : [];

  if (rules.length === 0) {
    return { error: "Campaign belum punya rule. Tambahkan rule dulu di builder." };
  }

  // Buat record analisis (QUEUED) lalu panggil engine.
  const analysis = await db.videoAnalysis.create({
    data: {
      campaignId: effectiveCampaignId,
      submissionId,
      sourceUrl: url,
      platform: platform as never,
      caption,
      ruleSnapshot: rules.map((r) => toEngineRule(r)) as Prisma.InputJsonValue,
      results: [] as Prisma.InputJsonValue,
      status: "PROCESSING",
    },
  });

  try {
    const report = await runAnalysis({
      url,
      platform: platform as "auto" | "tiktok" | "instagram" | "youtube",
      language: "id",
      caption: caption ?? undefined,
      campaign_id: effectiveCampaignId ?? undefined,
      rules: rules.map((r) => toEngineRule(r)),
    });

    await db.videoAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "COMPLETED",
        score: report.score,
        compliant: report.compliant,
        transcript: report.transcript,
        durationSec: report.duration_sec ?? null,
        results: report.results as Prisma.InputJsonValue,
        error: report.errors.length ? report.errors.join(" | ") : null,
      },
    });
    revalidatePath("/admin/analyzer");
    return { success: `Analisis selesai. Skor ${report.score}/100, ${report.compliant ? "PATUH" : "TIDAK PATUH"}.` };
  } catch (e) {
    await db.videoAnalysis.update({
      where: { id: analysis.id },
      data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) },
    });
    revalidatePath("/admin/analyzer");
    return { error: `Analisis gagal: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Hapus laporan analisis. */
export async function deleteAnalysisAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("ADMIN");
  const id = String(formData.get("analysisId") ?? "");
  if (!id) return { error: "analysisId kosong." };
  await db.videoAnalysis.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/analyzer");
  return { success: "Laporan dihapus." };
}
