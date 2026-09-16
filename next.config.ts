import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Seluruh ilustrasi Kontem berformat SVG dan berasal dari `public/`
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/health",
        destination: "/api/health",
      },
      {
        source: "/health/ready",
        destination: "/api/health/ready",
      },
    ];
  },
};

export default nextConfig;
