import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Liquidity Square",
    short_name: "The Square",
    description: "Follow the tape, share a thesis, and talk markets on The Square.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B1210",
    theme_color: "#0B1210",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
