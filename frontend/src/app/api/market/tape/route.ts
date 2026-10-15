import { NextResponse } from "next/server";
import { cacheTtlSeconds, getTape } from "@/lib/market/tape";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

function sweepAlerts(snapshot: { sessionDate: string; quotes: { symbol: string; changePct: number }[] }) {
  const secret = process.env.ALERT_SWEEP_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) return;

  void fetch(`${BACKEND_URL}/api/alerts/sweep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-sweep-key": secret } : {}),
    },
    body: JSON.stringify({
      sessionDate: snapshot.sessionDate,
      quotes: snapshot.quotes.map((quote) => ({ symbol: quote.symbol, changePct: quote.changePct })),
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((error) => console.error("Price alert sweep failed", error));
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = await getTape();
    sweepAlerts(snapshot);
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
