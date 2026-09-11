import "server-only";
import { db } from "@/lib/db";
import { calculatePayouts, type PayoutResult } from "./payout";
import type { SubmissionStatus } from "@/generated/prisma/enums";

/** Hanya submission berstatus ini yang views-nya ikut dihitung untuk payout. */
export const COUNTABLE_STATUSES: SubmissionStatus[] = [
  "APPROVED",
  "ADMIN_APPROVED",
];

export type CampaignPerformance = PayoutResult & {
  /** Submission yang views-nya diperhitungkan, sudah diurutkan dari terbesar. */
  ranking: Array<{
    creatorId: string;
    creatorName: string;
    submissionId: string;
    views: number;
    netAmount: number;
    sharePercent: number;
  }>;
};

/**
 * Hitung posisi terkini sebuah campaign: total views, proyeksi pembagian pool,
 * dan peringkat creator. Dipakai dashboard vendor, estimasi earning creator,
 * dan pratinjau payout admin — supaya ketiganya selalu memakai angka yang sama.
 */
export async function getCampaignPerformance(
  campaignId: string,
): Promise<CampaignPerformance | null> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { budgetPool: true, cpmRate: true, platformFeeRate: true },
  });
  if (!campaign) return null;

  const submissions = await db.submission.findMany({
    where: { campaignId, status: { in: COUNTABLE_STATUSES } },
    select: {
      id: true,
      creatorId: true,
      lastViews: true,
      finalViews: true,
      creator: { select: { name: true } },
    },
  });

  const entries = submissions.map((submission) => ({
    creatorId: submission.creatorId,
    submissionId: submission.id,
    // finalViews dikunci saat settle; sebelum itu pakai snapshot terakhir.
    views: submission.finalViews ?? submission.lastViews,
  }));

  const result = calculatePayouts(entries, campaign);

  const nameById = new Map(
    submissions.map((s) => [s.creatorId, s.creator.name] as const),
  );

  const ranking = result.lines
    .map((line) => ({
      creatorId: line.creatorId,
      creatorName: nameById.get(line.creatorId) ?? "—",
      submissionId: line.submissionId ?? "",
      views: line.viewsCounted,
      netAmount: line.netAmount,
      sharePercent: line.sharePercent,
    }))
    .sort((a, b) => b.views - a.views);

  return { ...result, ranking };
}
