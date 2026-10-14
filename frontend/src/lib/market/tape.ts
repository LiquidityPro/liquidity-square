import { nextRefreshAt } from "./session";

const NGX_EQUITIES = "https://doclib.ngxgroup.com/REST/api/statistics/equities/";
const PAGE_SIZE = 300;
const RETRY_MS = 60_000;

export type TapeQuote = {
  symbol: string;
  price: number;
  changePct: number;
  sector: string;
};

export type TapeSnapshot = {
  sessionDate: string;
  fetchedAt: string;
  refreshAt: string;
  quotes: TapeQuote[];
};

type NgxEquity = {
  Symbol?: string;
  ClosePrice?: number | null;
  PrevClosingPrice?: number | null;
  Change?: number | null;
  PercChange?: number | null;
  TradeDate?: string;
  Sector?: string | null;
};

type CacheEntry = {
  snapshot: TapeSnapshot;
  expiresAt: number;
};

let memory: CacheEntry | null = null;
let inflight: Promise<TapeSnapshot> | null = null;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function changePercent(row: NgxEquity): number {
  const close = row.ClosePrice;
  const prev = row.PrevClosingPrice;
  if (finite(close) && finite(prev) && prev !== 0) {
    return round2(((close - prev) / prev) * 100);
  }
  if (finite(row.Change) && finite(prev) && prev !== 0) {
    return round2((row.Change / prev) * 100);
  }
  if (finite(row.PercChange)) {
    return round2(row.PercChange);
  }
  return 0;
}

function quoteFromRow(row: NgxEquity): { price: number; changePct: number } | null {
  const close = finite(row.ClosePrice) ? row.ClosePrice : null;
  const prev = finite(row.PrevClosingPrice) ? row.PrevClosingPrice : null;
  const change = finite(row.Change) ? row.Change : null;
  const perc = finite(row.PercChange) ? row.PercChange : null;

  if (close != null) {
    return { price: close, changePct: changePercent(row) };
  }

  if (change != null && prev != null) {
    return { price: round2(prev + change), changePct: changePercent(row) };
  }

  if (perc != null && perc !== 0 && prev != null && prev !== 0) {
    return { price: round2(prev * (1 + perc / 100)), changePct: round2(perc) };
  }

  if (prev != null) {
    return { price: prev, changePct: 0 };
  }

  return null;
}

export function normalizeEquities(rows: NgxEquity[]): { sessionDate: string; quotes: TapeQuote[] } {
  let sessionDate = "";
  const bySymbol = new Map<string, TapeQuote>();

  for (const row of rows) {
    const symbol = row.Symbol?.trim().toUpperCase();
    const quote = quoteFromRow(row);
    if (!symbol || !quote) continue;

    const day = String(row.TradeDate ?? "").slice(0, 10);
    if (day > sessionDate) sessionDate = day;

    bySymbol.set(symbol, {
      symbol,
      price: quote.price,
      changePct: quote.changePct,
      sector: row.Sector?.trim() || "NGX",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || bySymbol.size === 0) {
    throw new Error("NGX returned no usable equity session");
  }

  const quotes = Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { sessionDate, quotes };
}

async function fetchPage(pageNo: number): Promise<NgxEquity[]> {
  const url = new URL(NGX_EQUITIES);
  url.searchParams.set("market", "");
  url.searchParams.set("sector", "");
  url.searchParams.set("orderby", "");
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("pageNo", String(pageNo));

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`NGX equities request failed (${res.status})`);
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("NGX equities payload was not a list");
  }
  return data as NgxEquity[];
}

async function fetchEquities(): Promise<{ sessionDate: string; quotes: TapeQuote[] }> {
  const rows: NgxEquity[] = [];
  for (let pageNo = 0; pageNo < 5; pageNo += 1) {
    const batch = await fetchPage(pageNo);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return normalizeEquities(rows);
}

function remember(snapshot: TapeSnapshot, expiresAt: number): TapeSnapshot {
  memory = { snapshot, expiresAt };
  return snapshot;
}

async function refresh(now: Date): Promise<TapeSnapshot> {
  try {
    const session = await fetchEquities();
    const refreshAt = nextRefreshAt(now);
    return remember(
      {
        ...session,
        fetchedAt: now.toISOString(),
        refreshAt: refreshAt.toISOString(),
      },
      refreshAt.getTime(),
    );
  } catch (error) {
    if (memory) {
      const refreshAt = new Date(now.getTime() + RETRY_MS);
      console.error("NGX tape refresh failed; serving the last session", error);
      return remember(
        { ...memory.snapshot, refreshAt: refreshAt.toISOString() },
        refreshAt.getTime(),
      );
    }
    throw error;
  }
}

export function getTape(now = new Date()): Promise<TapeSnapshot> {
  if (memory && now.getTime() < memory.expiresAt) {
    return Promise.resolve(memory.snapshot);
  }
  if (!inflight) {
    inflight = refresh(now).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function cacheTtlSeconds(refreshAt: string, now = Date.now()): number {
  return Math.max(1, Math.floor((new Date(refreshAt).getTime() - now) / 1000));
}
