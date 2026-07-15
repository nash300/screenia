import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/launch-readiness": [
      "./docs/**/*",
      "./public/**/*",
      "./src/**/*",
      "./supabase/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
