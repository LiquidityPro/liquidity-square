import { NextResponse } from "next/server";
import { cacheTtlSeconds, getTape } from "@/lib/market/tape";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = await getTape();
    const ttl = cacheTtlSeconds(snapshot.refreshAt);
    const cdn = `public, s-maxage=${ttl}, stale-while-revalidate=60`;

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "CDN-Cache-Control": cdn,
        "Vercel-CDN-Cache-Control": cdn,
      },
    });
  } catch (error) {
    console.error("Market tape unavailable", error);
    return NextResponse.json({ error: "Market tape is unavailable" }, { status: 502 });
  }
}
