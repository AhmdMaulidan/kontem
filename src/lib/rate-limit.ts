/**
 * In-memory sliding window rate limiter dan throttling utilitas.
 * Cocok untuk runtime Node.js Next.js Server Actions dan API endpoints.
 */

interface RateRecord {
  timestamps: number[];
}

interface ThrottleRecord {
  lastActionAt: number;
}

const rateStore = new Map<string, RateRecord>();
const throttleStore = new Map<string, ThrottleRecord>();

// Bersihkan rekaman basi secara berkala setiap 5 menit agar memori tidak bocor
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupAt = Date.now();

function purgeExpiredRecords(now: number, maxWindowMs: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  for (const [key, record] of rateStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < maxWindowMs);
    if (record.timestamps.length === 0) {
      rateStore.delete(key);
    }
  }

  for (const [key, record] of throttleStore.entries()) {
    if (now - record.lastActionAt > maxWindowMs) {
      throttleStore.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface ThrottleResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Rate Limiting (Sliding Window): Membatasi frekuensi aksi per satuan waktu.
 * Contoh: 20 aksi per 60 detik per actor.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  purgeExpiredRecords(now, windowMs);

  let record = rateStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateStore.set(key, record);
  }

  // Filter hanya timestamp yang masih berada di dalam jendela waktu
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldest));
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  // Tambahkan timestamp saat ini
  record.timestamps.push(now);

  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    retryAfterMs: 0,
  };
}

/**
 * Throttling (Cooldown): Membatasi jeda minimum antar-dua aksi pada sebuah target.
 * Contoh: Harus ada jeda minimal 5 menit sebelum video yang sama bisa di-update lagi.
 */
export function checkThrottle(
  key: string,
  cooldownMs: number,
  now: number = Date.now(),
): ThrottleResult {
  purgeExpiredRecords(now, cooldownMs * 2);

  const record = throttleStore.get(key);
  if (!record) {
    throttleStore.set(key, { lastActionAt: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  const elapsed = now - record.lastActionAt;
  if (elapsed < cooldownMs) {
    return {
      allowed: false,
      retryAfterMs: cooldownMs - elapsed,
    };
  }

  record.lastActionAt = now;
  return { allowed: true, retryAfterMs: 0 };
}

/** Reset semua record (berguna untuk pengujian) */
export function clearRateLimitStores(): void {
  rateStore.clear();
  throttleStore.clear();
}

/** Reset record rate limit tertentu atau semua jika key tidak diberikan */
export function resetRateLimit(key?: string): void {
  if (key) {
    rateStore.delete(key);
    throttleStore.delete(key);
  } else {
    rateStore.clear();
    throttleStore.clear();
  }
}
