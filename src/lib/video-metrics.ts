/**
 * Layanan penarikan metrik video/konten media sosial secara ultra-ringan (HTTP fetch).
 * Beroperasi tanpa headless browser (Chromium/Puppeteer), hemat CPU dan memori server.
 */

export interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  author: string;
  title: string;
}

/**
 * Mengambil metrik postingan TikTok (video maupun photo carousel) via endpoint JSON ringan.
 * Mengembalikan angka riil: views, likes, comments, shares, dan info kreator.
 */
export async function fetchTikTokMetrics(url: string): Promise<VideoMetrics> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10 detik batas timeout

  try {
    const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Kontem-Metrics-Fetcher/1.0",
        Accept: "application/json",
      },
      // Jangan gunakan cache agar mendapatkan data angka views teranyar
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Server metrik merespons dengan status ${response.status}.`);
    }

    const json = await response.json();

    if (json.code !== 0 || !json.data) {
      throw new Error(
        json.msg || "Postingan tidak ditemukan, berstatus private, atau telah dihapus.",
      );
    }

    return {
      views: Number(json.data.play_count) || 0,
      likes: Number(json.data.digg_count) || 0,
      comments: Number(json.data.comment_count) || 0,
      shares: Number(json.data.share_count) || 0,
      author: String(json.data.author?.unique_id || ""),
      title: String(json.data.title || ""),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Koneksi ke server penarik metrik timeout (melebihi 10 detik).");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Router pengambil metrik berdasarkan platform media sosial.
 */
export async function fetchVideoMetrics(
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE",
  url: string,
): Promise<VideoMetrics> {
  switch (platform) {
    case "TIKTOK":
      return fetchTikTokMetrics(url);

    case "YOUTUBE":
      throw new Error(
        "Penarikan otomatis YouTube belum dikonfigurasi (membutuhkan YOUTUBE_API_KEY).",
      );

    case "INSTAGRAM":
      throw new Error(
        "Penarikan otomatis Instagram belum dikonfigurasi (membutuhkan Meta Graph Access Token).",
      );

    default:
      throw new Error(`Platform ${platform} tidak didukung.`);
  }
}
