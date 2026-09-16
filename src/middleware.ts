import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 1. Ambil atau buat Request ID unik untuk tracing/observability
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  // 2. Clone headers request dan tambahkan x-request-id
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // 3. Lanjutkan request dengan header yang sudah diperbarui
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 4. Salin x-request-id ke response header agar client bisa melaporkannya saat ada issue
  response.headers.set("x-request-id", requestId);

  // 5. Injeksi Security Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

export const config = {
  matcher: [
    /*
     * Cocokkan semua request kecuali:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - file publik dengan ekstensi (.svg, .png, .jpg, .webp, dll)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
