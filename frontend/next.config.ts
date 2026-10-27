import path from "path";
import type { NextConfig } from "next";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
const DESK_URL = (process.env.DESK_URL || "https://liquidity-square-desk.vercel.app").replace(/\/$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  // On Vercel, vercel.json routes /api/server/* to the backend service before it reaches Next.
  // /desk is served by the separate desk deployment. It stays out of vercel.json because that
  // file can only route into this project's own services.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/desk", destination: `${DESK_URL}/desk` },
        { source: "/desk/:path*", destination: `${DESK_URL}/desk/:path*` },
      ],
      afterFiles: [{ source: "/api/server/:path*", destination: `${BACKEND_URL}/api/:path*` }],
    };
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
