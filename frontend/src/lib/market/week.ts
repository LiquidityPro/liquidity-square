export type FilingKind = "dividend" | "results" | "meeting" | "filing";

export type WeekFiling = {
  id: string;
  symbol: string;
  company: string;
  kind: FilingKind;
  label: string;
  title: string;
  url: string;
  filedAt: string;
};

const LIST = "https://doclib.ngxgroup.com/_api/Web/Lists/GetByTitle('XFinancial_News')/items/";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Cache = { filings: WeekFiling[]; expiresAt: number };
let memory: Cache | null = null;
let inflight: Promise<WeekFiling[]> | null = null;

function kindOf(type: string, title: string): FilingKind {
  const text = `${type} ${title}`.toLowerCase();
  if (text.includes("dividend") || text.includes("scrip")) return "dividend";
  if (
    text.includes("financial statement") ||
    text.includes("earnings") ||
    text.includes("closed period") ||
    text.includes("results")
  ) {
    return "results";
  }
  if (text.includes("meeting") || text.includes("agm") || text.includes("egm")) return "meeting";
  return "filing";
}

function labelOf(kind: FilingKind, type: string) {
  if (kind === "dividend") return "Dividend";
  if (kind === "results") return "Results";
  if (kind === "meeting") return "Meeting";
  const cleaned = type.replace(/\s+/g, " ").trim();
  return cleaned || "Filing";
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function urlOf(value: unknown): { url: string; title: string } {
  if (value && typeof value === "object") {
    const row = value as { Url?: unknown; Description?: unknown; url?: unknown; description?: unknown };
    return { url: textOf(row.Url ?? row.url), title: textOf(row.Description ?? row.description) };
  }
  return { url: "", title: "" };
}

function fromRecord(row: Record<string, unknown>, index: number): WeekFiling | null {
  const symbol = textOf(row.CompanySymbol ?? row.companySymbol).toUpperCase();
  const company = textOf(row.CompanyName ?? row.companyName);
  const type = textOf(row.Type_of_Submission ?? row.type_of_submission);
  const filedAt = textOf(row.Created ?? row.created);
  const link = urlOf(row.URL ?? row.Url ?? row.url);
  if (!symbol || !/^[A-Z0-9.]{2,12}$/.test(symbol) || !filedAt || !link.url) return null;
  const filed = new Date(filedAt);
  if (Number.isNaN(filed.getTime())) return null;
  const kind = kindOf(type, link.title);
  return {
    id: `${symbol}-${filed.getTime()}-${index}`,
    symbol,
    company: company || symbol,
    kind,
    label: labelOf(kind, type),
    title: link.title || type || company || symbol,
    url: link.url,
    filedAt: filed.toISOString(),
  };
}

function recordsFromJson(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const root = data as { d?: { results?: unknown }; value?: unknown };
  const results = root.d?.results ?? root.value;
  return Array.isArray(results) ? results.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : [];
}

function recordsFromXml(xml: string): Record<string, unknown>[] {
  const entries = xml.split("<entry").slice(1);
  return entries.map((entry) => {
    const field = (name: string) => {
      const match = entry.match(new RegExp(`<d:${name}[^>]*>([\\s\\S]*?)</d:${name}>`));
      return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    };
    return {
      CompanySymbol: field("CompanySymbol"),
      CompanyName: field("CompanyName"),
      Type_of_Submission: field("Type_of_Submission"),
      Created: field("Created"),
      URL: { Url: field("Url"), Description: field("Description") },
    };
  });
}

export function normalizeFilings(rows: Record<string, unknown>[], now = Date.now()): WeekFiling[] {
  const cutoff = now - WEEK_MS;
  const filings = rows
    .map((row, index) => fromRecord(row, index))
    .filter((row): row is WeekFiling => !!row && new Date(row.filedAt).getTime() >= cutoff);
  const seen = new Set<string>();
  return filings
    .filter((row) => {
      const key = `${row.symbol}|${row.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.filedAt.localeCompare(a.filedAt));
}

async function loadFilings(now = Date.now()): Promise<WeekFiling[]> {
  const since = new Date(now - WEEK_MS).toISOString();
  const url = new URL(LIST);
  url.searchParams.set("$select", "URL,Created,CompanyName,CompanySymbol,Type_of_Submission");
  url.searchParams.set("$orderby", "Created desc");
  url.searchParams.set("$filter", `Created ge datetime'${since}'`);
  url.searchParams.set("$top", "80");

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json;odata=verbose" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NGX filings request failed (${res.status})`);

  const body = await res.text();
  const rows = body.trim().startsWith("<") ? recordsFromXml(body) : recordsFromJson(JSON.parse(body) as unknown);
  return normalizeFilings(rows, now);
}

export function getWeekFilings(now = Date.now()): Promise<WeekFiling[]> {
  if (memory && now < memory.expiresAt) return Promise.resolve(memory.filings);
  if (!inflight) {
    inflight = loadFilings(now)
      .then((filings) => {
        memory = { filings, expiresAt: now + 15 * 60 * 1000 };
        return filings;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
