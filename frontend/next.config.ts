import type { NextConfig } from "next";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // On Vercel, vercel.json routes /api/server/* to the backend service before it reaches Next.
  async rewrites() {
    return [{ source: "/api/server/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
