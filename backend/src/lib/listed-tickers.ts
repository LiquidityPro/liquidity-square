import { prisma } from "./prisma";

const NGX_EQUITIES = "https://doclib.ngxgroup.com/REST/api/statistics/equities/";
const PAGE_SIZE = 300;
const REFRESH_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 60_000;
const SEEDED_COUNT = 100;

type NgxEquity = {
  Symbol?: string;
  Sector?: string | null;
  Company2?: string | null;
};

export type ListedTicker = {
  symbol: string;
  name: string | null;
  sector: string | null;
};

let syncedAt = 0;
let failedAt = 0;
let inflight: Promise<number> | null = null;

function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text || null;
}

export function listedFromEquities(rows: NgxEquity[]): ListedTicker[] {
  const bySymbol = new Map<string, ListedTicker>();
  for (const row of rows) {
    const symbol = row.Symbol?.trim().toUpperCase();
    if (!symbol || !/^[A-Z]{2,12}$/.test(symbol)) continue;
    bySymbol.set(symbol, {
      symbol,
      name: clean(row.Company2),
      sector: clean(row.Sector),
    });
  }
  return Array.from(bySymbol.values());
}

async function fetchEquities(): Promise<ListedTicker[]> {
  const rows: NgxEquity[] = [];
  for (let pageNo = 0; pageNo < 5; pageNo += 1) {
    const url = new URL(NGX_EQUITIES);
    url.searchParams.set("market", "");
    url.searchParams.set("sector", "");
    url.searchParams.set("orderby", "");
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    url.searchParams.set("pageNo", String(pageNo));

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`NGX equities request failed (${res.status})`);

    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error("NGX equities payload was not a list");
    rows.push(...(data as NgxEquity[]));
    if (data.length < PAGE_SIZE) break;
  }

  const listed = listedFromEquities(rows);
  if (listed.length === 0) throw new Error("NGX returned no listed equities");
  return listed;
}

async function upsertListed(listed: ListedTicker[]): Promise<number> {
  const chunkSize = 40;
  for (let index = 0; index < listed.length; index += chunkSize) {
    const chunk = listed.slice(index, index + chunkSize);
    await prisma.$transaction(
      chunk.map((ticker) =>
        prisma.ticker.upsert({
          where: { symbol: ticker.symbol },
          create: ticker,
          update: {
            // The equities feed often repeats the symbol in Company2. Don't wipe a real name.
            ...(ticker.name && ticker.name.toUpperCase() !== ticker.symbol ? { name: ticker.name } : {}),
            ...(ticker.sector ? { sector: ticker.sector } : {}),
          },
        }),
      ),
    );
  }
  return listed.length;
}

export async function syncListedTickers(): Promise<number> {
  return upsertListed(await fetchEquities());
}

function kickoff(): Promise<number> {
  if (!inflight) {
    inflight = syncListedTickers()
      .then((count) => {
        syncedAt = Date.now();
        failedAt = 0;
        console.log(`Synced ${count} listed NGX tickers`);
        return count;
      })
      .catch((error) => {
        failedAt = Date.now();
        console.error("Listed ticker sync failed", error);
        return 0;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Fill `tickers` from the NGX list. Rows already posted about keep their posts. */
export async function ensureListedTickers(): Promise<number> {
  if (syncedAt && Date.now() - syncedAt < REFRESH_MS) return 0;
  if (failedAt && Date.now() - failedAt < RETRY_MS) return 0;

  const count = await prisma.ticker.count();
  if (count >= SEEDED_COUNT) {
    syncedAt = Date.now();
    void kickoff();
    return count;
  }

  return kickoff();
}
