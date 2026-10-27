import type { NextConfig } from "next";

const basePath = process.env.ADMIN_BASE_PATH || "";
const backend = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  agentRules: false,
  ...(basePath ? { basePath } : {}),
  async rewrites() {
    // On the shared Vercel host, /api/server is already routed to the backend.
    // Locally the desk is its own origin, so proxy the API from here.
    if (basePath) return [];
    return [{ source: "/api/server/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
