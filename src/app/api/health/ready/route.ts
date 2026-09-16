import { errorResponse, successResponse, ErrorCode } from "@/lib/api-response";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health Check - Readiness Endpoint (GET /api/health/ready atau GET /health/ready)
 * Digunakan untuk memverifikasi kesiapan menerima trafik produksi, termasuk
 * ketersediaan koneksi database PostgreSQL / Supabase.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Eksekusi lightweight ping query ke database
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    return successResponse(
      {
        status: "READY",
        database: "CONNECTED",
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      200,
      undefined,
      {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    );
  } catch (error) {
    console.error("[Health Readiness Error] Database ping failed:", error);

    // Mencegah kebocoran kredensial atau connection string internal
    return errorResponse(
      ErrorCode.SERVICE_UNAVAILABLE,
      "Layanan database belum siap atau tidak dapat dijangkau.",
      503,
      {
        status: "NOT_READY",
        database: "DISCONNECTED",
      },
      {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    );
  }
}
