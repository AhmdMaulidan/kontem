import { calculatePayouts, type PayoutResult } from "./payout";
import type {
  CampaignStatus,
  SocialPlatform,
  SubmissionStatus,
} from "@/generated/prisma/enums";

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
    rawViews: number;
    isCapped: boolean;
    netAmount: number;
    sharePercent: number;
  }>;
};

export type TopPerformer = {
  rank: number;
  creatorId: string;
  creatorName: string;
  submissionId: string;
  contentUrl: string;
  platform: SocialPlatform;
  views: number;
  rawViews: number;
  isCapped: boolean;
  sharePercent: number;
  grossAmount: number;
  netAmount: number;
};

export type PlatformMetric = {
  platform: SocialPlatform;
  submissionsCount: number;
  totalViews: number;
  sharePercent: number;
};

export type CampaignSettlementSummary = {
  campaignId: string;
  campaignTitle: string;
  status: CampaignStatus;
  isSettled: boolean;
  settledAt: Date | null;
  /** Total views riil dari seluruh konten yang disetujui (sebelum pembatasan plafon). */
  totalReach: number;
  /** Total views yang diakui setelah pembatasan plafon maxViewsPerCreator. */
  totalCountedViews: number;
  /** Total submission yang masuk. */
  totalSubmissions: number;
  /** Jumlah konten yang disetujui dan views-nya dihitung. */
  approvedSubmissions: number;
  /** Jumlah konten yang ditolak. */
  rejectedSubmissions: number;
  /** Jumlah kreator unik yang berpartisipasi dan disetujui. */
  creatorsCount: number;
  /** Budget pool yang dikunci saat pembuatan. */
  budgetPool: number;
  /** Total pengeluaran pool kotor (yang dibagikan ke kreator). */
  budgetSpent: number;
  /** Sisa pool yang dikembalikan ke rekening vendor. */
  refundAmount: number;
  /** Persentase dana terserap dari budget pool (0 - 100%). */
  budgetAbsorptionRate: number;
  /** Target CPM yang ditetapkan vendor saat awal. */
  targetCpm: number;
  /** Realized CPM aktual yang dinikmati vendor: (budgetSpent / totalReach) * 1000. */
  realizedCpm: number;
  /** Persentase efisiensi/penghematan CPM dibanding target (positif = lebih hemat). */
  cpmEfficiencyPercent: number;
  /** Kreator dengan views tertinggi (Top 3). */
  topPerformers: TopPerformer[];
  /** Breakdown performa per platform media sosial. */
  platforms: PlatformMetric[];
};

export type SettlementCalculationInput = {
  campaign: {
    id: string;
    title: string;
    budgetPool: number;
    cpmRate: number;
    platformFeeRate: number;
    maxViewsPerCreator?: number | null;
    status: CampaignStatus;
    settledAt?: Date | null;
  };
  submissions: Array<{
    id: string;
    creatorId: string;
    creatorName: string;
    status: SubmissionStatus;
    platform: SocialPlatform;
    contentUrl: string;
    lastViews: number;
    finalViews?: number | null;
  }>;
  payouts?: Array<{
    creatorId: string;
    submissionId: string | null;
    viewsCounted: number;
    grossAmount: number;
    netAmount: number;
    sharePercent: number;
  }>;
};

/**
 * Hitung ringkasan analitik penyelesaian kampanye (post-settlement report)
 * murni tanpa akses langsung ke database sehingga mudah diuji.
 */
export function calculateCampaignSettlementSummary(
  input: SettlementCalculationInput,
): CampaignSettlementSummary {
  const { campaign, submissions } = input;
  const approvedList = submissions.filter((s) =>
    COUNTABLE_STATUSES.includes(s.status),
  );
  const rejectedCount = submissions.filter((s) => s.status === "REJECTED").length;

  const totalReach = approvedList.reduce(
    (sum, s) => sum + (s.finalViews ?? s.lastViews),
    0,
  );

  let budgetSpent = 0;
  let refundAmount = 0;
  let totalCountedViews = 0;
  let payoutLines: Array<{
    creatorId: string;
    submissionId: string | null;
    viewsCounted: number;
    grossAmount: number;
    netAmount: number;
    sharePercent: number;
  }> = [];

  if (input.payouts && input.payouts.length > 0) {
    payoutLines = input.payouts;
    budgetSpent = input.payouts.reduce((sum, p) => sum + p.grossAmount, 0);
    refundAmount = Math.max(0, campaign.budgetPool - budgetSpent);
    totalCountedViews = input.payouts.reduce((sum, p) => sum + p.viewsCounted, 0);
  } else {
    const entries = approvedList.map((s) => ({
      creatorId: s.creatorId,
      submissionId: s.id,
      views: s.finalViews ?? s.lastViews,
    }));
    const calc = calculatePayouts(entries, {
      budgetPool: campaign.budgetPool,
      cpmRate: campaign.cpmRate,
      platformFeeRate: campaign.platformFeeRate,
      maxViewsPerCreator: campaign.maxViewsPerCreator,
    });
    budgetSpent = calc.totalDistributed;
    refundAmount = calc.refundToVendor;
    totalCountedViews = calc.totalViews;
    payoutLines = calc.lines;
  }

  const budgetAbsorptionRate =
    campaign.budgetPool > 0
      ? Number(((budgetSpent / campaign.budgetPool) * 100).toFixed(1))
      : 0;

  const realizedCpm =
    totalReach > 0
      ? Math.round((budgetSpent / totalReach) * 1000)
      : campaign.cpmRate;

  const cpmEfficiencyPercent =
    campaign.cpmRate > 0
      ? Number(
          (((campaign.cpmRate - realizedCpm) / campaign.cpmRate) * 100).toFixed(1),
        )
      : 0;

  const uniqueCreators = new Set(approvedList.map((s) => s.creatorId)).size;

  const payoutMap = new Map(
    payoutLines.map((p) => [p.creatorId, p] as const),
  );

  const topPerformers: TopPerformer[] = approvedList
    .map((s) => {
      const rawViews = s.finalViews ?? s.lastViews;
      const line = payoutMap.get(s.creatorId);
      const viewsCounted = line?.viewsCounted ?? rawViews;
      const isCapped = rawViews > viewsCounted;
      return {
        rank: 0,
        creatorId: s.creatorId,
        creatorName: s.creatorName,
        submissionId: s.id,
        contentUrl: s.contentUrl,
        platform: s.platform,
        views: viewsCounted,
        rawViews,
        isCapped,
        sharePercent: line?.sharePercent ?? 0,
        grossAmount: line?.grossAmount ?? 0,
        netAmount: line?.netAmount ?? 0,
      };
    })
    .sort((a, b) => b.rawViews - a.rawViews)
    .slice(0, 3)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // Platform distribution
  const platformGroups = new Map<SocialPlatform, { count: number; views: number }>();
  for (const s of approvedList) {
    const rawViews = s.finalViews ?? s.lastViews;
    const curr = platformGroups.get(s.platform) ?? { count: 0, views: 0 };
    platformGroups.set(s.platform, {
      count: curr.count + 1,
      views: curr.views + rawViews,
    });
  }

  const platforms: PlatformMetric[] = Array.from(platformGroups.entries()).map(
    ([platform, data]) => ({
      platform,
      submissionsCount: data.count,
      totalViews: data.views,
      sharePercent:
        totalReach > 0 ? Number(((data.views / totalReach) * 100).toFixed(1)) : 0,
    }),
  );

  return {
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    status: campaign.status,
    isSettled: campaign.status === "SETTLED" || payoutLines.length > 0,
    settledAt: campaign.settledAt ?? null,
    totalReach,
    totalCountedViews,
    totalSubmissions: submissions.length,
    approvedSubmissions: approvedList.length,
    rejectedSubmissions: rejectedCount,
    creatorsCount: uniqueCreators,
    budgetPool: campaign.budgetPool,
    budgetSpent,
    refundAmount,
    budgetAbsorptionRate,
    targetCpm: campaign.cpmRate,
    realizedCpm,
    cpmEfficiencyPercent,
    topPerformers,
    platforms,
  };
}

/**
 * Mengambil ringkasan laporan penyelesaian kampanye dari database.
 */
export async function getCampaignSettlementSummary(
  campaignId: string,
): Promise<CampaignSettlementSummary | null> {
  const { db } = await import("@/lib/db");
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      title: true,
      budgetPool: true,
      cpmRate: true,
      platformFeeRate: true,
      maxViewsPerCreator: true,
      status: true,
      settledAt: true,
      submissions: {
        select: {
          id: true,
          creatorId: true,
          status: true,
          platform: true,
          contentUrl: true,
          lastViews: true,
          finalViews: true,
          creator: { select: { name: true } },
        },
      },
      payouts: {
        select: {
          creatorId: true,
          submissionId: true,
          viewsCounted: true,
          grossAmount: true,
          netAmount: true,
          sharePercent: true,
        },
      },
    },
  });

  if (!campaign) return null;

  return calculateCampaignSettlementSummary({
    campaign: {
      id: campaign.id,
      title: campaign.title,
      budgetPool: campaign.budgetPool,
      cpmRate: campaign.cpmRate,
      platformFeeRate: campaign.platformFeeRate,
      maxViewsPerCreator: campaign.maxViewsPerCreator,
      status: campaign.status,
      settledAt: campaign.settledAt,
    },
    submissions: campaign.submissions.map((s) => ({
      id: s.id,
      creatorId: s.creatorId,
      creatorName: s.creator.name,
      status: s.status,
      platform: s.platform,
      contentUrl: s.contentUrl,
      lastViews: s.lastViews,
      finalViews: s.finalViews,
    })),
    payouts: campaign.payouts,
  });
}

/**
 * Hitung posisi terkini sebuah campaign: total views, proyeksi pembagian pool,
 * dan peringkat creator. Dipakai dashboard vendor, estimasi earning creator,
 * dan pratinjau payout admin — supaya ketiganya selalu memakai angka yang sama.
 */
export async function getCampaignPerformance(
  campaignId: string,
): Promise<CampaignPerformance | null> {
  const { db } = await import("@/lib/db");
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      budgetPool: true,
      cpmRate: true,
      platformFeeRate: true,
      maxViewsPerCreator: true,
    },
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
      rawViews: line.rawViews,
      isCapped: line.isCapped,
      netAmount: line.netAmount,
      sharePercent: line.sharePercent,
    }))
    .sort((a, b) => b.views - a.views);

  return { ...result, ranking };
}
