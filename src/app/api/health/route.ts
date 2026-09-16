import { successResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * Health Check - Liveness Endpoint (GET /api/health atau GET /health)
 * Digunakan oleh load balancer / container orchestrator untuk memverifikasi
 * bahwa server aplikasi Node.js masih hidup dan mampu merespons HTTP request.
 */
export async function GET() {
  return successResponse(
    {
      status: "UP",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    200,
    undefined,
    {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  );
}
