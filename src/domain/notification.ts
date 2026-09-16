import type { NotificationType, VerificationStatus } from "@/generated/prisma/enums";

export interface NearbyCampaignNotificationParams {
  campaignId: string;
  campaignTitle: string;
  businessName: string;
  city: string;
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
}

export interface CreatorTarget {
  userId: string;
  city: string;
  status: VerificationStatus;
}

/**
 * Membentuk payload notifikasi standar untuk kampanye baru di sekitar/kota domisili kreator.
 */
export function buildNearbyCampaignNotification(
  params: NearbyCampaignNotificationParams,
): NotificationPayload {
  const cleanCity = params.city.trim();
  const title = `Campaign baru di ${cleanCity}!`;
  const body = `"${params.campaignTitle}" oleh ${params.businessName.trim()} baru saja dibuka di kotamu. Klaim slot dan buat konten sekarang!`;
  const link = `/creator/campaigns/${params.campaignId}`;

  return {
    type: "CAMPAIGN_NEW_NEARBY",
    title,
    body,
    link,
  };
}

/**
 * Filter kreator yang berhak menerima notifikasi kampanye baru di kota tertentu.
 * Hanya menyertakan kreator dengan akun terverifikasi (status: VERIFIED)
 * dan kota domisili yang cocok (case-insensitive & trimmed).
 */
export function filterCreatorsForCity(
  creators: CreatorTarget[],
  targetCity: string,
): CreatorTarget[] {
  const normalizedTarget = targetCity.trim().toLowerCase();
  if (!normalizedTarget) return [];

  return creators.filter((creator) => {
    if (creator.status !== "VERIFIED") return false;
    const normalizedCreatorCity = creator.city.trim().toLowerCase();
    return normalizedCreatorCity === normalizedTarget;
  });
}

/**
 * Mengirimkan notifikasi kampanye baru secara massal kepada seluruh kreator terverifikasi
 * yang berdomisili di kota tempat usaha vendor.
 */
export async function broadcastNewCampaignToNearbyCreators(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaClient: any,
  params: NearbyCampaignNotificationParams,
): Promise<{ count: number; notifiedUserIds: string[] }> {
  const normalizedCity = params.city.trim();
  if (!normalizedCity) {
    return { count: 0, notifiedUserIds: [] };
  }

  // Cari seluruh kreator aktif di kota tempat usaha vendor
  const nearbyCreators = await prismaClient.creatorProfile.findMany({
    where: {
      city: { equals: normalizedCity, mode: "insensitive" },
      user: { status: "VERIFIED" },
    },
    select: { userId: true },
  });

  if (!nearbyCreators || nearbyCreators.length === 0) {
    return { count: 0, notifiedUserIds: [] };
  }

  const payload = buildNearbyCampaignNotification(params);
  const notifiedUserIds = nearbyCreators.map((c: { userId: string }) => c.userId);

  await prismaClient.notification.createMany({
    data: notifiedUserIds.map((userId: string) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link,
    })),
  });

  return {
    count: notifiedUserIds.length,
    notifiedUserIds,
  };
}
