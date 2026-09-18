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

export interface CampaignEndingSoonNotificationParams {
  campaignId: string;
  campaignTitle: string;
  hoursLeft: number;
}

/**
 * Membentuk payload notifikasi standar untuk kampanye aktif yang segera berakhir (H-2 / H-1).
 */
export function buildCampaignEndingSoonNotification(
  params: CampaignEndingSoonNotificationParams,
): NotificationPayload {
  const title = `Campaign "${params.campaignTitle}" segera berakhir!`;
  const body = `Tersisa ${params.hoursLeft} jam lagi untuk menyelesaikan kunjungan dan mengunggah kontenmu untuk "${params.campaignTitle}". Jangan lewatkan reward pool-mu!`;
  const link = `/creator/campaigns/${params.campaignId}`;

  return {
    type: "CAMPAIGN_ENDING_SOON",
    title,
    body,
    link,
  };
}

/**
 * Mengirimkan notifikasi peringatan kampanye mau berakhir kepada para kreator terdaftar
 * yang belum mengunggah konten.
 * Menghindari duplikasi notifikasi untuk kreator yang sama pada kampanye tersebut.
 */
export async function notifyParticipantsCampaignEndingSoon(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaClient: any,
  params: CampaignEndingSoonNotificationParams,
): Promise<{ count: number; notifiedUserIds: string[] }> {
  const { campaignId, campaignTitle, hoursLeft } = params;

  // 1. Ambil partisipasi yang belum submit konten
  const pendingParticipants = await prismaClient.campaignParticipation.findMany({
    where: {
      campaignId,
      submission: null,
    },
    select: { creatorId: true },
  });

  if (!pendingParticipants || pendingParticipants.length === 0) {
    return { count: 0, notifiedUserIds: [] };
  }

  const creatorIds = pendingParticipants.map(
    (p: { creatorId: string }) => p.creatorId,
  );

  // 2. Filter kreator yang sudah menerima notifikasi CAMPAIGN_ENDING_SOON untuk campaign ini
  const existingNotifications = await prismaClient.notification.findMany({
    where: {
      userId: { in: creatorIds },
      type: "CAMPAIGN_ENDING_SOON",
      link: `/creator/campaigns/${campaignId}`,
    },
    select: { userId: true },
  });

  const alreadyNotifiedSet = new Set(
    existingNotifications.map((n: { userId: string }) => n.userId),
  );
  const targetUserIds = creatorIds.filter(
    (userId: string) => !alreadyNotifiedSet.has(userId),
  );

  if (targetUserIds.length === 0) {
    return { count: 0, notifiedUserIds: [] };
  }

  const payload = buildCampaignEndingSoonNotification({
    campaignId,
    campaignTitle,
    hoursLeft,
  });

  await prismaClient.notification.createMany({
    data: targetUserIds.map((userId: string) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link,
    })),
  });

  return {
    count: targetUserIds.length,
    notifiedUserIds: targetUserIds,
  };
}

