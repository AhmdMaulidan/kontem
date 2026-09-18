import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runCampaignLifecycleSync } from "@/domain/lifecycle";

export const dynamic = "force-dynamic";

/**
 * Endpoint cron untuk memeriksa dan memperbarui siklus hidup kampanye secara terjadwal:
 * - Menutup campaign yang telah melewati masa endDate.
 * - Memberitahu admin jika campaign ENDED telah melewati trackingEndsAt dan siap disettle.
 * - Mengirim notifikasi H-2/H-1 untuk campaign yang akan segera berakhir.
 *
 * Proteksi:
 * Memeriksa Authorization: Bearer <CRON_SECRET>.
 * Jika CRON_SECRET tidak disetel pada environment development, request tetap diizinkan.
 */
async function handleLifecycleSync(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (process.env.NODE_ENV === "production" && !cronSecret) {
    return NextResponse.json(
      { error: "Server Misconfiguration: CRON_SECRET belum dikonfigurasi di environment produksi." },
      { status: 500 },
    );
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized: Token CRON_SECRET tidak valid." },
      { status: 401 },
    );
  }

  try {
    const result = await runCampaignLifecycleSync(db);
    return NextResponse.json({
      success: true,
      message: "Sinkronisasi siklus hidup kampanye berhasil dijalankan.",
      data: result,
    });
  } catch (error) {
    console.error("[Cron Campaign Lifecycle Error]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan internal saat sinkronisasi siklus hidup.",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handleLifecycleSync(req);
}

export async function POST(req: NextRequest) {
  return handleLifecycleSync(req);
}
