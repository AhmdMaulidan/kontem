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
}

/**
 * Menganalisis pertumbuhan views dan mendeteksi anomali penurunan views.
 * Views di platform media sosial bersifat kumulatif dan tidak pernah berkurang secara organik.
 */
export function analyzeViewGrowth(
  previousViews: number,
  currentViews: number,
): ViewGrowthAnalysis {
  const deltaViews = currentViews - previousViews;
  const isSuspiciousDecrease = deltaViews < 0;

  const growthPercent =
    previousViews > 0 ? Number(((deltaViews / previousViews) * 100).toFixed(2)) : 0;

  return {
    deltaViews,
    growthPercent,
    isSuspiciousDecrease,
  };
}
