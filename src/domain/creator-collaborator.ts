import type { SocialPlatform, SubmissionStatus } from "@/generated/prisma/enums";

export interface RawParticipationWithSubmission {
  id: string;
  joinedAt: Date;
  campaign: {
    id: string;
    title: string;
  };
  creator: {
    id: string;
    name: string;
    avatarUrl: string | null;
    creatorProfile?: {
      city?: string | null;
      trustScore?: number | null;
    } | null;
    socialAccounts?: Array<{
      platform: SocialPlatform;
      handle: string;
      profileUrl: string;
    }> | null;
  };
  submission?: {
    id: string;
    status: SubmissionStatus;
    platform: SocialPlatform;
    contentUrl: string;
    lastViews: number;
    finalViews: number | null;
    reviewedAt: Date | null;
  } | null;
}

export interface VendorCollaboratorSummary {
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
  city: string;
  trustScore: number;
  socialAccounts: Array<{
    platform: SocialPlatform;
    handle: string;
    profileUrl: string;
  }>;
  campaignsCount: number;
  approvedSubmissionsCount: number;
  totalViewsGenerated: number;
  lastCollaboratedAt: Date;
  campaignTitles: string[];
}

/**
 * Agregasi data partisipasi kampanye vendor menjadi rekam jejak kolaborator kreator.
 * Hanya kreator yang memiliki setidaknya satu konten disetujui (APPROVED/ADMIN_APPROVED)
 * yang dimasukkan ke dalam daftar kolaborator.
 */
export function aggregateVendorCollaborators(
  participations: RawParticipationWithSubmission[],
): VendorCollaboratorSummary[] {
  const map = new Map<
    string,
    {
      creatorId: string;
      creatorName: string;
      creatorAvatar: string | null;
      city: string;
      trustScore: number;
      socialAccountsMap: Map<string, { platform: SocialPlatform; handle: string; profileUrl: string }>;
      campaignTitlesSet: Set<string>;
      approvedCount: number;
      totalViews: number;
      latestDate: Date;
    }
  >();

  for (const part of participations) {
    const sub = part.submission;
    const isApproved =
      sub && (sub.status === "APPROVED" || sub.status === "ADMIN_APPROVED");

    // Hanya catat kreator yang memiliki submission disetujui
    if (!isApproved) continue;

    const creatorId = part.creator.id;
    let entry = map.get(creatorId);

    if (!entry) {
      entry = {
        creatorId,
        creatorName: part.creator.name,
        creatorAvatar: part.creator.avatarUrl,
        city: part.creator.creatorProfile?.city ?? "—",
        trustScore: part.creator.creatorProfile?.trustScore ?? 50,
        socialAccountsMap: new Map(),
        campaignTitlesSet: new Set(),
        approvedCount: 0,
        totalViews: 0,
        latestDate: sub.reviewedAt ?? part.joinedAt,
      };
      map.set(creatorId, entry);
    }

    // Update social accounts jika ada
    if (part.creator.socialAccounts) {
      for (const sa of part.creator.socialAccounts) {
        const key = `${sa.platform}:${sa.handle.toLowerCase()}`;
        if (!entry.socialAccountsMap.has(key)) {
          entry.socialAccountsMap.set(key, sa);
        }
      }
    }

    // Update campaign titles
    if (part.campaign?.title) {
      entry.campaignTitlesSet.add(part.campaign.title);
    }

    // Akumulasi views dan hitungan konten
    const countedViews = sub.finalViews ?? sub.lastViews;
    entry.totalViews += countedViews;
    entry.approvedCount += 1;

    // Catat tanggal kolaborasi terkini
    const subDate = sub.reviewedAt ?? part.joinedAt;
    if (subDate.getTime() > entry.latestDate.getTime()) {
      entry.latestDate = subDate;
    }
  }

  // Bentuk array summary terurut berdasarkan total views tertinggi
  const result: VendorCollaboratorSummary[] = Array.from(map.values()).map(
    (entry) => ({
      creatorId: entry.creatorId,
      creatorName: entry.creatorName,
      creatorAvatar: entry.creatorAvatar,
      city: entry.city,
      trustScore: entry.trustScore,
      socialAccounts: Array.from(entry.socialAccountsMap.values()),
      campaignsCount: entry.campaignTitlesSet.size,
      approvedSubmissionsCount: entry.approvedCount,
      totalViewsGenerated: entry.totalViews,
      lastCollaboratedAt: entry.latestDate,
      campaignTitles: Array.from(entry.campaignTitlesSet),
    }),
  );

  return result.sort((a, b) => b.totalViewsGenerated - a.totalViewsGenerated);
}

/**
 * Mengambil daftar kreator yang pernah berkolaborasi dan menyelesaikan konten di kampanye vendor.
 */
export async function getVendorCollaborators(
  vendorId: string,
): Promise<VendorCollaboratorSummary[]> {
  const { db } = await import("@/lib/db");

  const participations = await db.campaignParticipation.findMany({
    where: {
      campaign: { vendorId },
      submission: {
        status: { in: ["APPROVED", "ADMIN_APPROVED"] },
      },
    },
    include: {
      campaign: { select: { id: true, title: true } },
      creator: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          creatorProfile: { select: { city: true, trustScore: true } },
          socialAccounts: {
            select: { platform: true, handle: true, profileUrl: true },
          },
        },
      },
      submission: {
        select: {
          id: true,
          status: true,
          platform: true,
          contentUrl: true,
          lastViews: true,
          finalViews: true,
          reviewedAt: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return aggregateVendorCollaborators(
    participations as unknown as RawParticipationWithSubmission[],
  );
}
