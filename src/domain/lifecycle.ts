import type { CampaignStatus } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { notifyParticipantsCampaignEndingSoon } from "./notification";
import { COUNTABLE_STATUSES } from "./campaign";
import { calculatePayouts } from "./payout";
import { calculateCreatorEarning } from "./withdrawal";

export interface CampaignTransitionEval {
  shouldEnd: boolean;
  reason?: string;
}

export interface TrackingPeriodEval {
  isTrackingOver: boolean;
  reason?: string;
}

/**
 * Evaluasi apakah campaign ACTIVE sudah melewati tanggal endDate dan harus beralih ke ENDED.
 */
export function evaluateCampaignTransitionToEnd(
  campaign: { status: CampaignStatus; endDate: Date | string },
  now: Date = new Date(),
): CampaignTransitionEval {
  if (campaign.status !== "ACTIVE") {
    return { shouldEnd: false, reason: "Status campaign bukan ACTIVE" };
  }

  const end = new Date(campaign.endDate);
  if (now.getTime() >= end.getTime()) {
    return {
      shouldEnd: true,
      reason: `Periode campaign telah berakhir pada ${end.toISOString()}`,
    };
  }

  return { shouldEnd: false, reason: "Periode campaign masih berlangsung" };
}

/**
 * Evaluasi apakah campaign ENDED sudah melewati masa pelacakan views (trackingEndsAt)
 * dan siap untuk diselesaikan (settle) oleh admin.
 */
export function evaluateTrackingPeriodFinished(
  campaign: { status: CampaignStatus; trackingEndsAt: Date | string | null },
  now: Date = new Date(),
): TrackingPeriodEval {
  if (campaign.status !== "ENDED") {
    return {
      isTrackingOver: false,
      reason: "Status campaign bukan ENDED",
    };
  }

  if (!campaign.trackingEndsAt) {
    return {
      isTrackingOver: true,
      reason: "Campaign tidak memiliki masa jeda tracking, siap disettle",
    };
  }

  const trackingEnd = new Date(campaign.trackingEndsAt);
  if (now.getTime() >= trackingEnd.getTime()) {
    return {
      isTrackingOver: true,
      reason: `Masa pelacakan views berakhir pada ${trackingEnd.toISOString()}`,
    };
  }

  return {
    isTrackingOver: false,
    reason: "Masa pelacakan views masih berlangsung",
  };
}

export interface CampaignEndingSoonEval {
  isEndingSoon: boolean;
  hoursLeft: number;
  reason?: string;
}

/**
 * Evaluasi apakah campaign ACTIVE berada dalam rentang ambang batas segera berakhir (misal <= 48 jam sebelum endDate).
 */
export function evaluateCampaignEndingSoon(
  campaign: { status: CampaignStatus; endDate: Date | string },
  now: Date = new Date(),
  thresholdHours: number = 48,
): CampaignEndingSoonEval {
  if (campaign.status !== "ACTIVE") {
    return {
      isEndingSoon: false,
      hoursLeft: 0,
      reason: "Status campaign bukan ACTIVE",
    };
  }

  const end = new Date(campaign.endDate);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isEndingSoon: false,
      hoursLeft: 0,
      reason: "Periode campaign telah berakhir",
    };
  }

  const hoursLeft = Math.ceil(diffMs / (1000 * 60 * 60));

  if (hoursLeft <= thresholdHours) {
    return {
      isEndingSoon: true,
      hoursLeft,
      reason: `Campaign segera berakhir dalam ${hoursLeft} jam`,
    };
  }

  return {
    isEndingSoon: false,
    hoursLeft,
    reason: `Campaign masih berlangsung (${hoursLeft} jam tersisa)`,
  };
}

export interface LifecycleSyncResult {
  campaignsEnded: number;
  campaignsSettled: number;
  endingSoonAlertsSent: number;
  timestamp: string;
}

/**
 * Settlement + pencairan payout sepenuhnya otomatis untuk satu campaign,
 * dipanggil dari `runCampaignLifecycleSync` begitu masa tracking views-nya
 * selesai. Menggantikan alur lama yang mengharuskan admin klik "Hitung
 * pembagian pool" lalu "Cairkan" secara manual — di sini keduanya jadi satu
 * langkah atomik karena toh pencairannya sendiri tetap simulasi (tidak ada
 * integrasi payment gateway sungguhan), jadi tidak ada alasan menunggu klik
 * admin sebelum menandainya PAID.
 *
 * Video yang sudah dicairkan lebih dulu lewat penarikan dini (Withdrawal
 * status PAID) dikecualikan dari batch proporsional ini — jatahnya sudah
 * final — dan sisa budget pool untuk creator lain dikurangi sebesar itu,
 * supaya vendor tetap tidak pernah membayar lebih dari budgetPool.
 */
async function autoSettleCampaign(
  db: PrismaClient,
  campaign: {
    id: string;
    title: string;
    budgetPool: number;
    cpmRate: number;
    platformFeeRate: number;
    maxViewsPerCreator: number | null;
  },
): Promise<{ settled: boolean; reason?: string }> {
  // Penarikan dini yang masih menunggu approval/transfer manual admin
  // menahan sisa pool yang belum pasti — settlement ditunda ke siklus cron
  // berikutnya alih-alih menghitung dengan angka yang bisa berubah.
  const withdrawalPending = await db.withdrawal.count({
    where: {
      campaignId: campaign.id,
      status: { in: ["PENDING_ADMIN_APPROVAL", "APPROVED"] },
    },
  });
  if (withdrawalPending > 0) {
    return {
      settled: false,
      reason: `${withdrawalPending} penarikan dini belum diputuskan/dicairkan admin.`,
    };
  }

  const submissions = await db.submission.findMany({
    where: { campaignId: campaign.id, status: { in: COUNTABLE_STATUSES } },
    include: { withdrawal: true },
  });

  const submissionSudahDitarik = submissions.filter(
    (s) => s.withdrawal?.status === "PAID",
  );
  const submissionBelumDitarik = submissions.filter(
    (s) => s.withdrawal?.status !== "PAID",
  );
  const totalSudahDitarik = submissionSudahDitarik.reduce(
    (sum, s) => sum + (s.withdrawal?.grossAmount ?? 0),
    0,
  );

  const entries = submissionBelumDitarik.map((submission) => ({
    creatorId: submission.creatorId,
    submissionId: submission.id,
    views: submission.finalViews ?? submission.lastViews,
  }));

  const hasil = calculatePayouts(entries, {
    budgetPool: Math.max(0, campaign.budgetPool - totalSudahDitarik),
    cpmRate: campaign.cpmRate,
    platformFeeRate: campaign.platformFeeRate,
    maxViewsPerCreator: campaign.maxViewsPerCreator,
  });

  await db.$transaction(async (tx) => {
    for (const submission of submissions) {
      await tx.submission.update({
        where: { id: submission.id },
        data: { finalViews: submission.finalViews ?? submission.lastViews },
      });
    }

    // Payout cermin untuk video yang sudah cair via penarikan dini — supaya
    // "Riwayat payout" di /creator/earnings tetap satu sumber lengkap untuk
    // semua uang yang pernah diterima, apa pun jalurnya.
    for (const submission of submissionSudahDitarik) {
      const w = submission.withdrawal!;
      const ulang = calculateCreatorEarning(w.viewsCounted, campaign);
      await tx.payout.create({
        data: {
          campaignId: campaign.id,
          creatorId: submission.creatorId,
          submissionId: submission.id,
          viewsCounted: w.viewsCounted,
          totalPoolViews: w.viewsCounted,
          sharePercent: 100,
          grossAmount: ulang.rawGrossAmount,
          platformFee: ulang.rawGrossAmount - ulang.grossAmount,
          netAmount: w.netAmount,
          status: "PAID",
          paidAt: w.paidAt,
          note: `Dicairkan lebih awal lewat penarikan dini (fee penarikan ${w.feeAmount.toLocaleString("id-ID")} rupiah).`,
        },
      });
    }

    for (const line of hasil.lines) {
      await tx.payout.create({
        data: {
          campaignId: campaign.id,
          creatorId: line.creatorId,
          submissionId: line.submissionId,
          viewsCounted: line.viewsCounted,
          totalPoolViews: line.totalPoolViews,
          sharePercent: line.sharePercent,
          grossAmount: line.grossAmount,
          platformFee: line.platformFee,
          netAmount: line.netAmount,
          status: "PAID",
          paidAt: new Date(),
        },
      });
      await tx.notification.create({
        data: {
          userId: line.creatorId,
          type: "PAYOUT_RELEASED",
          title: "Payout otomatis cair",
          body: `Campaign "${campaign.title}" selesai. ${line.netAmount.toLocaleString("id-ID")} rupiah sudah otomatis ditransfer ke rekening terdaftar.`,
          link: "/creator/earnings",
        },
      });
    }

    if (hasil.totalPlatformFee > 0) {
      await tx.escrowTransaction.create({
        data: {
          campaignId: campaign.id,
          type: "PLATFORM_FEE",
          amount: hasil.totalPlatformFee,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    }

    if (hasil.totalNetToCreators > 0) {
      await tx.escrowTransaction.create({
        data: {
          campaignId: campaign.id,
          type: "PAYOUT",
          amount: hasil.totalNetToCreators,
          status: "COMPLETED",
          reference: `AUTO-SETTLE-${Date.now()}`,
          completedAt: new Date(),
        },
      });
    }

    if (hasil.refundToVendor > 0) {
      await tx.escrowTransaction.create({
        data: {
          campaignId: campaign.id,
          type: "REFUND",
          amount: hasil.refundToVendor,
          status: "PENDING",
          note: "Sisa pool yang tidak terserap.",
        },
      });
    }

    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: "SETTLED", settledAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: null, // dieksekusi sistem, bukan admin
        action: "campaign.auto_settle",
        entity: "Campaign",
        entityId: campaign.id,
        metadata: {
          totalViews: hasil.totalViews,
          dibagikan: hasil.totalDistributed,
          fee: hasil.totalPlatformFee,
          refund: hasil.refundToVendor,
          sudahDitarikDini: totalSudahDitarik,
        },
      },
    });
  });

  return { settled: true };
}

/**
 * Menjalankan siklus hidup kampanye secara menyeluruh:
 * 1. Menutup kampanye ACTIVE yang sudah melewati endDate -> status ENDED.
 * 2. Mengirim notifikasi kesiapan settle untuk kampanye ENDED yang melewati trackingEndsAt.
 * 3. Mengirim notifikasi H-2/H-1 untuk kampanye ACTIVE yang akan berakhir.
 */
export async function runCampaignLifecycleSync(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<LifecycleSyncResult> {
  let campaignsEnded = 0;
  let campaignsSettled = 0;
  let endingSoonAlertsSent = 0;

  // 1. Ambil seluruh campaign ACTIVE yang telah melewati endDate
  const activeCampaigns = await db.campaign.findMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: now },
    },
    include: {
      vendor: true,
    },
  });

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  for (const campaign of activeCampaigns) {
    await db.$transaction(async (tx) => {
      // Ubah status campaign menjadi ENDED
      await tx.campaign.update({
        where: { id: campaign.id },
        data: { status: "ENDED" },
      });

      // Notifikasi vendor
      await tx.notification.create({
        data: {
          userId: campaign.vendorId,
          type: "GENERAL",
          title: "Periode campaign telah berakhir",
          body: `Campaign "${campaign.title}" telah berakhir. Sistem kini memasuki masa pelacakan views akhir sebelum perhitungan bagi hasil (settlement).`,
          link: `/vendor/campaigns/${campaign.id}`,
        },
      });

      // Notifikasi admin
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((adm: { id: string }) => ({
            userId: adm.id,
            type: "GENERAL",
            title: "Campaign berakhir",
            body: `Campaign "${campaign.title}" telah beralih ke status ENDED.`,
            link: "/admin/campaigns",
          })),
        });
      }

      // Catat AuditLog
      await tx.auditLog.create({
        data: {
          action: "campaign.lifecycle.ended",
          entity: "Campaign",
          entityId: campaign.id,
          metadata: {
            alasan: "Periode kampanye selesai (endDate terlewati)",
            waktuSelesai: campaign.endDate,
          },
        },
      });
    });

    campaignsEnded++;
  }

  // 2. Ambil campaign ENDED yang telah melewati masa pelacakan trackingEndsAt,
  // lalu settle + cairkan otomatis (tidak ada lagi langkah manual admin).
  const trackingOverCampaigns = await db.campaign.findMany({
    where: {
      status: "ENDED",
      trackingEndsAt: { lte: now },
      settledAt: null,
    },
  });

  for (const c of trackingOverCampaigns) {
    const hasil = await autoSettleCampaign(db, c);
    if (hasil.settled) {
      campaignsSettled++;
    } else {
      // Ditunda ke siklus cron berikutnya (mis. masih ada penarikan dini
      // yang belum diputuskan admin) — catat sekali saja per campaign
      // supaya admin tidak dibanjiri notifikasi berulang tiap cron jalan.
      const sudahNotif = await db.auditLog.findFirst({
        where: { action: "campaign.lifecycle.settle_deferred", entityId: c.id },
      });
      if (!sudahNotif && admins.length > 0) {
        await db.notification.createMany({
          data: admins.map((adm: { id: string }) => ({
            userId: adm.id,
            type: "GENERAL",
            title: "Settlement otomatis tertunda",
            body: `Campaign "${c.title}" siap disettle, tapi tertunda: ${hasil.reason}`,
            link: "/admin/submissions?tab=penarikan",
          })),
        });
        await db.auditLog.create({
          data: {
            action: "campaign.lifecycle.settle_deferred",
            entity: "Campaign",
            entityId: c.id,
            metadata: { alasan: hasil.reason ?? null },
          },
        });
      }
    }
  }

  // 3. Ambil campaign ACTIVE yang akan berakhir dalam 48 jam ke depan (H-2 / H-1)
  const thresholdEndingSoon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const endingSoonCampaigns = await db.campaign.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gt: now, lte: thresholdEndingSoon },
    },
    select: {
      id: true,
      title: true,
      endDate: true,
      status: true,
    },
  });

  for (const c of endingSoonCampaigns) {
    const evalResult = evaluateCampaignEndingSoon(c, now, 48);
    if (evalResult.isEndingSoon) {
      const alertRes = await notifyParticipantsCampaignEndingSoon(db, {
        campaignId: c.id,
        campaignTitle: c.title,
        hoursLeft: evalResult.hoursLeft,
      });
      endingSoonAlertsSent += alertRes.count;
    }
  }

  return {
    campaignsEnded,
    campaignsSettled,
    endingSoonAlertsSent,
    timestamp: now.toISOString(),
  };
}
