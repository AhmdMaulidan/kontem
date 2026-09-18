import type { CampaignStatus } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { notifyParticipantsCampaignEndingSoon } from "./notification";

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
  settleAlertsSent: number;
  endingSoonAlertsSent: number;
  timestamp: string;
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
  let settleAlertsSent = 0;
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

  // 2. Ambil campaign ENDED yang telah melewati masa pelacakan trackingEndsAt
  const trackingOverCampaigns = await db.campaign.findMany({
    where: {
      status: "ENDED",
      trackingEndsAt: { lte: now },
      // Pastikan belum disettle
      settledAt: null,
    },
  });

  for (const c of trackingOverCampaigns) {
    // Hindari duplikasi notifikasi settle alert menggunakan AuditLog
    const sudahNotif = await db.auditLog.findFirst({
      where: {
        action: "campaign.lifecycle.tracking_ended",
        entityId: c.id,
      },
    });

    if (!sudahNotif) {
      if (admins.length > 0) {
        await db.notification.createMany({
          data: admins.map((adm: { id: string }) => ({
            userId: adm.id,
            type: "GENERAL",
            title: "Masa pelacakan views selesai",
            body: `Campaign "${c.title}" telah menyelesaikan masa pelacakan views (trackingEndsAt). Silakan lakukan settlement di panel Payouts.`,
            link: "/admin/payouts",
          })),
        });
      }

      await db.auditLog.create({
        data: {
          action: "campaign.lifecycle.tracking_ended",
          entity: "Campaign",
          entityId: c.id,
          metadata: {
            trackingEndsAt: c.trackingEndsAt,
          },
        },
      });

      settleAlertsSent++;
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
    settleAlertsSent,
    endingSoonAlertsSent,
    timestamp: now.toISOString(),
  };
}
