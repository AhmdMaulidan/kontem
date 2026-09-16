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
 * Mengekstrak 11 karakter ID video YouTube dari berbagai format tautan.
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const match = trimmed.match(
      /(?:shorts\/|v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/i,
    );
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Mengambil metrik YouTube Shorts via endpoint resmi Google oEmbed dan tag interactionCount HTML.
 * Bekerja tanpa API key, hemat CPU & memori server.
 */
export async function fetchYouTubeMetrics(url: string): Promise<VideoMetrics> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("URL YouTube Shorts tidak valid (ID video tidak ditemukan).");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    // 1. Ambil metadata judul dan channel author dari endpoint oEmbed resmi Google/YouTube
    const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const oembedResponse = await fetch(oembedEndpoint, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Kontem-Metrics-Fetcher/1.0",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!oembedResponse.ok) {
      if (oembedResponse.status === 404) {
        throw new Error(
          "Video YouTube Shorts tidak ditemukan, berstatus private, atau telah dihapus.",
        );
      }
      throw new Error(
        `Server YouTube oEmbed merespons dengan status ${oembedResponse.status}.`,
      );
    }

    const oembedData = await oembedResponse.json();
    const title = String(oembedData.title || "");

    // Ekstrak handle author dari author_url (misal https://www.youtube.com/@jawed)
    let author = "";
    if (oembedData.author_url) {
      const handleMatch = String(oembedData.author_url).match(/@([a-zA-Z0-9_.-]+)/);
      if (handleMatch) {
        author = handleMatch[1];
      }
    }
    if (!author && oembedData.author_name) {
      author = String(oembedData.author_name).trim();
    }

    // 2. Ambil views terkini dari tag publik interactionCount di halaman video
    let views = 0;
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const htmlResponse = await fetch(watchUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
      });

      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        const metaMatch =
          html.match(/<meta\s+itemprop="interactionCount"\s+content="(\d+)"/i) ||
          html.match(/itemprop="interactionCount"\s+content="(\d+)"/i) ||
          html.match(/"viewCount":\s*"(\d+)"/i);

        if (metaMatch) {
          views = Number(metaMatch[1]) || 0;
        }
      }
    } catch {
      // Jika HTML fetch gagal, views tetap 0 tanpa menggagalkan perolehan metadata author/title
    }

    return {
      views,
      likes: 0,
      comments: 0,
      shares: 0,
      author,
      title,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Koneksi ke server YouTube timeout (melebihi 10 detik).");
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
      return fetchYouTubeMetrics(url);

    case "INSTAGRAM":
      throw new Error(
        "Penarikan otomatis Instagram belum dikonfigurasi (membutuhkan Meta Graph Access Token).",
      );

    default:
      throw new Error(`Platform ${platform} tidak didukung.`);
  }
}
