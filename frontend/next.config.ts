import type { NextConfig } from "next";
import path from "path"; // ✅ add this

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ✅ FIX: set correct root
  outputFileTracingRoot: path.join(__dirname),

  // Allow LAN access for dev mode
  allowedDevOrigins: [
    "localhost",
    "10.1.24.102",
    "10.1.24.37",
  ],

  // Ignore ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        source: "/((?!login|forgot|session-expired|_next|images|favicon\\.ico|api).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;