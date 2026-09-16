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
 * Mengekstrak kode unik (shortcode) postingan atau reel Instagram dari berbagai format tautan.
 */
export function extractInstagramShortcode(url: string): string | null {
  try {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const match = trimmed.match(
      /(?:instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:reel|reels|p|tv|share\/reel|share\/p)\/|instagr\.am\/(?:p|reel)\/)([a-zA-Z0-9_-]+)/i,
    );
    if (!match) return null;
    const code = match[1];
    if (code.length < 5 || code.length > 35) return null;
    return code;
  } catch {
    return null;
  }
}

/**
 * Mengambil metrik Instagram Reels via endpoint public embed Instagram atau Meta Graph API.
 * Bekerja tanpa mewajibkan token privat dengan memanfaatkan public embed renderer.
 */
export async function fetchInstagramMetrics(url: string): Promise<VideoMetrics> {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) {
    throw new Error(
      "URL Instagram Reels tidak valid (kode postingan/reel tidak ditemukan).",
    );
  }

  // Ekstrak author handle dari URL jika disertakan (mis. instagram.com/username/reel/CODE)
  let authorFromUrl = "";
  const handleMatch = url
    .trim()
    .match(
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/(?:reel|reels|p|tv)/i,
    );
  if (
    handleMatch &&
    ![
      "reel",
      "reels",
      "p",
      "tv",
      "explore",
      "stories",
      "share",
    ].includes(handleMatch[1].toLowerCase())
  ) {
    authorFromUrl = handleMatch[1].replace(/^@/, "").toLowerCase();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    // 1. Cek apakah token Meta Graph API tersedia di environment
    const metaToken =
      process.env.META_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN;
    if (metaToken) {
      try {
        const oembedUrl = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${metaToken}`;
        const res = await fetch(oembedUrl, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          return {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            author: data.author_name
              ? String(data.author_name).trim()
              : authorFromUrl,
            title: data.title
              ? String(data.title).trim()
              : `Instagram Reel (${shortcode})`,
          };
        }
      } catch {
        // Lanjutkan ke fallback public embed
      }
    }

    // 2. Zero-config fallback: gunakan public embed endpoint resmi
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    let author = authorFromUrl;
    let title = `Instagram Reel (${shortcode})`;
    let views = 0;
    let likes = 0;
    const comments = 0;

    try {
      const embedResponse = await fetch(embedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        cache: "no-store",
      });

      if (embedResponse.ok) {
        const html = await embedResponse.text();

        // Ekstrak author handle dari atribut embed
        const authorMatch =
          html.match(
            /class=["']CaptionUsername["'][^>]*href=["'](?:https?:\/\/(?:www\.)?instagram\.com\/)?([a-zA-Z0-9_.]+)\/?["']/i,
          ) ||
          html.match(/"username":\s*"([a-zA-Z0-9_.]+)"/i) ||
          html.match(/@([a-zA-Z0-9_.]+)\s+on\s+Instagram/i) ||
          html.match(/href=["']\/([a-zA-Z0-9_.]+)\/["']/i);

        if (
          authorMatch &&
          authorMatch[1] &&
          !["explore", "reels", "reel", "p", "about"].includes(
            authorMatch[1].toLowerCase(),
          )
        ) {
          author = authorMatch[1].replace(/^@/, "").toLowerCase();
        }

        // Ekstrak caption/title jika ada
        const captionMatch =
          html.match(
            /<div class=["']CaptionComments["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
          ) ||
          html.match(/<div class=["']Caption["'][^>]*>([\s\S]*?)<\/div>/i) ||
          html.match(/data-caption=["']([^"']+)["']/i);

        if (captionMatch && captionMatch[1]) {
          title = captionMatch[1].replace(/<[^>]+>/g, "").trim();
        }

        // Ekstrak tayangan / views jika tertera di stat embed
        const viewMatch =
          html.match(/(\d[\d,.]*)\s+(?:views|tayangan)/i) ||
          html.match(/"video_view_count":\s*(\d+)/i);
        if (viewMatch) {
          views = parseInt(viewMatch[1].replace(/[,.]/g, ""), 10) || 0;
        }

        // Ekstrak suka / likes jika tertera di stat embed
        const likeMatch =
          html.match(/(\d[\d,.]*)\s+(?:likes|suka)/i) ||
          html.match(/"like_count":\s*(\d+)/i);
        if (likeMatch) {
          likes = parseInt(likeMatch[1].replace(/[,.]/g, ""), 10) || 0;
        }
      }
    } catch {
      // Jika embed fetch terkendala timeout/proteksi jaringan,
      // pertahankan author dan shortcode agar submission tidak gagal
    }

    return {
      views,
      likes,
      comments,
      shares: 0,
      author,
      title,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Koneksi ke server Instagram timeout (melebihi 10 detik).");
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
      return fetchInstagramMetrics(url);

    default:
      throw new Error(`Platform ${platform} tidak didukung.`);
  }
}

