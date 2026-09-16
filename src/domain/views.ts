/**
 * Aturan bisnis pelacakan views, jeda throttling, dan deteksi anomali.
 */

// Jeda waktu minimum antar-sinkronisasi views untuk satu konten (5 menit).
// Menghindari spam snapshot dan fluktuasi jangka pendek yang tidak realistis.
export const VIEW_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

// Batas maksimum pembaruan views per admin per menit (Rate Limiting).
export const MAX_VIEW_UPDATES_PER_MINUTE = 20;

export interface ViewThrottleValidation {
  allowed: boolean;
  remainingSeconds: number;
  message?: string;
}

/**
 * Memvalidasi apakah konten memenuhi syarat jeda waktu (throttling) untuk disinkronkan.
 * Admin dapat mem-bypass jika menandai aksi sebagai koreksi typo/kesalahan input.
 */
export function validateViewUpdateThrottle(
  lastSyncedAt: Date | null,
  isCorrection: boolean = false,
  now: Date = new Date(),
): ViewThrottleValidation {
  if (isCorrection) {
    return { allowed: true, remainingSeconds: 0 };
  }

  if (!lastSyncedAt) {
    return { allowed: true, remainingSeconds: 0 };
  }

  const elapsedMs = now.getTime() - lastSyncedAt.getTime();
  if (elapsedMs < VIEW_SYNC_COOLDOWN_MS) {
    const remainingMs = VIEW_SYNC_COOLDOWN_MS - elapsedMs;
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    return {
      allowed: false,
      remainingSeconds,
      message: `Konten ini baru diperbarui. Sinkronisasi dibatasi jeda 5 menit (sisa ${remainingSeconds} detik / ~${remainingMinutes} menit). Centang "Koreksi input" jika ingin memperbaiki salah ketik.`,
    };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * Mengecek apakah sebuah timestamp masih berada dalam masa jeda cooldown.
 */
export function isWithinCooldown(
  value: Date | string | null | undefined,
  cooldownMs: number = VIEW_SYNC_COOLDOWN_MS,
): boolean {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < cooldownMs;
}

export interface ViewGrowthAnalysis {
  deltaViews: number;
  growthPercent: number;
  isSuspiciousDecrease: boolean;
  isSpike: boolean;
  isEngagementMismatch: boolean;
}

export interface ViewFraudAssessment {
  hasFraud: boolean;
  severity: number;
  type: "INFLATED_VIEWS";
  reason: string;
}

/**
 * Menganalisis pertumbuhan views dan mendeteksi anomali:
 * 1. Penurunan views (views berkurang dari snapshot sebelumnya).
 * 2. Lonjakan ekstrem (spike velocity: lonjakan > 50.000 views dalam waktu singkat < 2 jam, atau pertumbuhan > 300% saat views > 10.000).
 * 3. Keterlibatan tidak wajar (views > 10.000 namun 0 likes & 0 comments - indikasi bot/view-farm).
 */
export function analyzeViewGrowth(
  previousViews: number,
  currentViews: number,
  previousTimestamp?: Date | string | null,
  currentTimestamp: Date = new Date(),
  currentLikes: number = 0,
  currentComments: number = 0,
): ViewGrowthAnalysis {
  const deltaViews = currentViews - previousViews;
  const isSuspiciousDecrease = deltaViews < 0;

  const growthPercent =
    previousViews > 0 ? Number(((deltaViews / previousViews) * 100).toFixed(2)) : 0;

  let elapsedHours = 24;
  if (previousTimestamp) {
    const prevTime = new Date(previousTimestamp).getTime();
    const currTime = currentTimestamp.getTime();
    elapsedHours = Math.max(0.01, (currTime - prevTime) / (1000 * 60 * 60));
  }

  const viewsPerHour = deltaViews / elapsedHours;

  const isSpike =
    deltaViews > 0 &&
    ((deltaViews >= 50_000 && elapsedHours <= 2) ||
      viewsPerHour >= 30_000 ||
      (currentViews >= 10_000 && previousViews > 0 && growthPercent >= 300));

  const isEngagementMismatch =
    currentViews >= 10_000 && currentLikes === 0 && currentComments === 0;

  return {
    deltaViews,
    growthPercent,
    isSuspiciousDecrease,
    isSpike,
    isEngagementMismatch,
  };
}

/**
 * Mengevaluasi apakah hasil analisis pertumbuhan views memerlukan FraudFlag otomatis oleh sistem.
 */
export function evaluateViewFraud(
  previousViews: number,
  currentViews: number,
  previousTimestamp?: Date | string | null,
  currentTimestamp: Date = new Date(),
  currentLikes: number = 0,
  currentComments: number = 0,
): ViewFraudAssessment | null {
  const analysis = analyzeViewGrowth(
    previousViews,
    currentViews,
    previousTimestamp,
    currentTimestamp,
    currentLikes,
    currentComments,
  );

  if (analysis.isSuspiciousDecrease) {
    return {
      hasFraud: true,
      severity: 2,
      type: "INFLATED_VIEWS",
      reason: `Penurunan views tidak wajar: berkurang dari ${previousViews.toLocaleString("id-ID")} menjadi ${currentViews.toLocaleString("id-ID")} (${analysis.deltaViews.toLocaleString("id-ID")}).`,
    };
  }

  if (analysis.isSpike) {
    return {
      hasFraud: true,
      severity: 3,
      type: "INFLATED_VIEWS",
      reason: `Lonjakan views ekstrem: bertambah ${analysis.deltaViews.toLocaleString("id-ID")} views (+${analysis.growthPercent}%) dalam durasi singkat. Indikasi bot atau view injection.`,
    };
  }

  if (analysis.isEngagementMismatch) {
    return {
      hasFraud: true,
      severity: 1,
      type: "INFLATED_VIEWS",
      reason: `Anomali interaksi: Konten mencatat ${currentViews.toLocaleString("id-ID")} views namun memiliki 0 likes dan 0 komentar.`,
    };
  }

  return null;
}

