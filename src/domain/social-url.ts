import type { SocialPlatform } from "@/generated/prisma/enums";

/**
 * Normalisasi handle media sosial:
 * Menghapus prefix '@', whitespace, dan ubah ke huruf kecil.
 */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

/**
 * Ekstrak username / handle dari tautan konten media sosial jika tersedia di struktur URL.
 * Mengembalikan null jika URL berupa shortlink atau tidak memuat username eksplisit.
 */
export function extractHandleFromUrl(
  url: string,
  platform: SocialPlatform,
): string | null {
  try {
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (platform === "TIKTOK") {
      // Format: tiktok.com/@username/video/123 atau tiktok.com/@username
      const match = trimmed.match(/tiktok\.com\/@([a-zA-Z0-9_.-]+)/i);
      return match ? normalizeHandle(match[1]) : null;
    }

    if (platform === "YOUTUBE") {
      // Format: youtube.com/@username/shorts/123 atau youtube.com/@username
      const match = trimmed.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/i);
      return match ? normalizeHandle(match[1]) : null;
    }

    if (platform === "INSTAGRAM") {
      // Format: instagram.com/username/reel/123 atau instagram.com/username/p/123
      // Abaikan jika segmen pertama adalah kata kunci sistem (reel, p, tv, stories)
      const match = trimmed.match(
        /instagram\.com\/(?!(?:reel|p|tv|stories|explore)\/)([a-zA-Z0-9_.-]+)\/(?:reel|p|tv)\//i,
      );
      return match ? normalizeHandle(match[1]) : null;
    }

    return null;
  } catch {
    return null;
  }
}

export type OwnershipVerificationResult = {
  isValid: boolean;
  extractedHandle: string | null;
  isExplicitMismatch: boolean;
  error?: string;
};

/**
 * Memvalidasi apakah URL konten cocok dengan akun media sosial yang didaftarkan kreator.
 */
export function verifyContentOwnership(input: {
  url: string;
  platform: SocialPlatform;
  registeredHandle: string;
}): OwnershipVerificationResult {
  const { url, platform, registeredHandle } = input;
  const normalizedRegistered = normalizeHandle(registeredHandle);
  const extracted = extractHandleFromUrl(url, platform);

  // Jika URL tidak memuat handle eksplisit (mis. shortlink vt.tiktok.com atau youtube.com/shorts/id),
  // loloskan di tahap submit dan verifikasi lanjutan saat metadata author ditarik.
  if (!extracted) {
    return {
      isValid: true,
      extractedHandle: null,
      isExplicitMismatch: false,
    };
  }

  if (extracted === normalizedRegistered) {
    return {
      isValid: true,
      extractedHandle: extracted,
      isExplicitMismatch: false,
    };
  }

  const platformName =
    platform === "TIKTOK"
      ? "TikTok"
      : platform === "INSTAGRAM"
        ? "Instagram"
        : "YouTube";

  return {
    isValid: false,
    extractedHandle: extracted,
    isExplicitMismatch: true,
    error: `Link konten ini berasal dari akun @${extracted}, sedangkan akun ${platformName} terdaftarmu adalah @${registeredHandle}. Pastikan kamu mengunggah video dari akun milikmu sendiri.`,
  };
}

/**
 * Memvalidasi kesesuaian author riil dari penarikan metrik video dengan akun kreator.
 */
export function verifyAuthorOwnership(input: {
  author: string;
  registeredHandle: string;
}): boolean {
  if (!input.author || !input.registeredHandle) return true;
  return normalizeHandle(input.author) === normalizeHandle(input.registeredHandle);
}
