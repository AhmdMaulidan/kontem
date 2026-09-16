import type {
  CampaignStatus,
  ParticipationStatus,
  RedeemCodeStatus,
} from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";

export interface CampaignTransitionEval {
  shouldEnd: boolean;
  reason?: string;
}

export interface RedeemCodeExpiryEval {
  shouldExpire: boolean;
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
 * Evaluasi apakah kode redeem UNUSED telah melewati batas kedaluwarsa (expiresAt).
 */
export function evaluateRedeemCodeExpiry(
  code: { status: RedeemCodeStatus; expiresAt: Date | string },
  now: Date = new Date(),
): RedeemCodeExpiryEval {
  if (code.status !== "UNUSED") {
    return { shouldExpire: false, reason: "Status kode bukan UNUSED" };
  }

  const exp = new Date(code.expiresAt);
  if (now.getTime() >= exp.getTime()) {
    return {
      shouldExpire: true,
      reason: `Batas waktu penukaran telah habis pada ${exp.toISOString()}`,
    };
  }

  return { shouldExpire: false, reason: "Kode masih berlaku" };
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

export interface LifecycleSyncResult {
  campaignsEnded: number;
  codesExpired: number;
  participationsCancelled: number;
  settleAlertsSent: number;
  timestamp: string;
}

/**
 * Menjalankan siklus hidup kampanye secara menyeluruh:
 * 1. Menutup kampanye ACTIVE yang sudah melewati endDate -> status ENDED.
 * 2. Membatalkan partisipasi JOINED yang tidak pernah mengunjungi lokasi dan kedaluwarsa-kan kode redeem-nya -> CANCELLED & EXPIRED.
 * 3. Menandai kode redeem UNUSED yang melewati expiresAt -> EXPIRED.
 * 4. Mengirim notifikasi kesiapan settle untuk kampanye ENDED yang melewati trackingEndsAt.
 */
export async function runCampaignLifecycleSync(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<LifecycleSyncResult> {
  let campaignsEnded = 0;
  let codesExpired = 0;
  let participationsCancelled = 0;
  let settleAlertsSent = 0;

  // 1. Ambil seluruh campaign ACTIVE yang telah melewati endDate
  const activeCampaigns = await db.campaign.findMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: now },
    },
    include: {
      participations: {
        where: { status: "JOINED" },
        include: { redeemCode: true },
      },
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

      // Batalkan partisipasi kreator yang belum pernah berkunjung fisik (status: JOINED)
      for (const p of campaign.participations) {
        await tx.campaignParticipation.update({
          where: { id: p.id },
          data: { status: "CANCELLED" as ParticipationStatus },
        });
        participationsCancelled++;

        if (p.redeemCode && p.redeemCode.status === "UNUSED") {
          await tx.redeemCode.update({
            where: { id: p.redeemCode.id },
            data: { status: "EXPIRED" as RedeemCodeStatus },
          });
          codesExpired++;
        }
      }

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
            partisipasiDibatalkan: campaign.participations.length,
          },
        },
      });
    });

    campaignsEnded++;
  }

  // 2. Ambil kode redeem UNUSED yang melewati expiresAt
  const expiredCodes = await db.redeemCode.findMany({
    where: {
      status: "UNUSED",
      expiresAt: { lte: now },
    },
    include: {
      participation: {
        include: {
          campaign: true,
        },
      },
    },
  });

  for (const code of expiredCodes) {
    await db.$transaction(async (tx) => {
      await tx.redeemCode.update({
        where: { id: code.id },
        data: { status: "EXPIRED" },
      });

      // Jika kreator belum berkunjung, batalkan partisipasinya
      if (code.participation.status === "JOINED") {
        await tx.campaignParticipation.update({
          where: { id: code.participationId },
          data: { status: "CANCELLED" },
        });
        participationsCancelled++;
      }

      // Notifikasi ke kreator
      await tx.notification.create({
        data: {
          userId: code.participation.creatorId,
          type: "GENERAL",
          title: "Kode kunjungan kedaluwarsa",
          body: `Kode redeem kunjungan untuk campaign "${code.participation.campaign.title}" telah kedaluwarsa karena melewati batas waktu kunjungan.`,
          link: `/creator/campaigns/${code.participation.campaignId}`,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "redeem.expired",
          entity: "RedeemCode",
          entityId: code.id,
          metadata: {
            campaignId: code.participation.campaignId,
            creatorId: code.participation.creatorId,
            expiresAt: code.expiresAt,
          },
        },
      });
    });

    codesExpired++;
  }

  // 3. Ambil campaign ENDED yang telah melewati masa pelacakan trackingEndsAt
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

  return {
    campaignsEnded,
    codesExpired,
    participationsCancelled,
    settleAlertsSent,
    timestamp: now.toISOString(),
  };
}
