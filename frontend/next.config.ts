import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
      { source: "/ws/:path*", destination: "http://localhost:8000/ws/:path*" },
      { source: "/admin/:path*", destination: "http://localhost:8000/admin/:path*" },
      { source: "/health", destination: "http://localhost:8000/health" },
    ];
  },
};

export default nextConfig;
