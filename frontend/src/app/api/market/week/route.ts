import { NextResponse } from "next/server";
import { getWeekFilings, type WeekFiling } from "@/lib/market/week";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sweepDisclosures(filings: WeekFiling[]) {
  const secret = process.env.ALERT_SWEEP_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) return;

  void fetch(`${BACKEND_URL}/api/disclosures/sweep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-sweep-key": secret } : {}),
    },
    body: JSON.stringify({
      filings: filings.map((filing) => ({
        symbol: filing.symbol,
        label: filing.label,
        title: filing.title,
        url: filing.url,
        filedAt: filing.filedAt,
      })),
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((error) => console.error("Disclosure sweep failed", error));
}

export async function GET(request: Request) {
  try {
    const symbol = new URL(request.url).searchParams.get("symbol")?.replace(/^\$/, "").trim().toUpperCase() ?? "";
    const filings = await getWeekFilings();
    sweepDisclosures(filings);
    const visible = symbol ? filings.filter((filing) => filing.symbol === symbol) : filings;
    return NextResponse.json(
      { filings: visible.slice(0, symbol ? 8 : 12) },
      { headers: { "Cache-Control": "public, max-age=0, must-revalidate", "CDN-Cache-Control": "public, s-maxage=300" } },
    );
  } catch (error) {
    console.error("Week filings unavailable", error);
    return NextResponse.json({ error: "The NGX filing calendar is unavailable" }, { status: 502 });
  }
}
