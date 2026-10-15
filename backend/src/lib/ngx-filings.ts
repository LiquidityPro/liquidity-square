import { createHash } from "node:crypto";

export type FilingNotice = {
  key: string;
  symbol: string;
  label: string;
  title: string;
  url: string;
  filedAt: Date;
};

const LIST = "https://doclib.ngxgroup.com/_api/Web/Lists/GetByTitle('XFinancial_News')/items/";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NGX_HOST = /^https:\/\/([a-z0-9-]+\.)*ngxgroup\.com\//i;

let memory: { filings: FilingNotice[]; expiresAt: number } | null = null;
let inflight: Promise<FilingNotice[]> | null = null;

export function filingKey(symbol: string, url: string) {
  return createHash("sha256").update(`${symbol}|${url}`).digest("hex");
}

export function allowedFilingUrl(url: string) {
  return NGX_HOST.test(url);
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

function labelOf(type: string, title: string) {
  const text = `${type} ${title}`.toLowerCase();
  if (text.includes("dividend") || text.includes("scrip")) return "Dividend";
  if (text.includes("financial statement") || text.includes("earnings") || text.includes("results")) return "Results";
  if (text.includes("meeting") || text.includes("agm") || text.includes("egm")) return "Meeting";
  return type.replace(/\s+/g, " ").trim() || "Filing";
}

function fromRecord(row: Record<string, unknown>): FilingNotice | null {
  const symbol = textOf(row.CompanySymbol ?? row.companySymbol).toUpperCase();
  const type = textOf(row.Type_of_Submission ?? row.type_of_submission);
  const filedAt = textOf(row.Created ?? row.created);
  const link = urlOf(row.URL ?? row.Url ?? row.url);
  const filed = new Date(filedAt);
  if (!symbol || !/^[A-Z0-9.]{2,12}$/.test(symbol) || Number.isNaN(filed.getTime()) || !allowedFilingUrl(link.url)) {
    return null;
  }
  const title = link.title || type || symbol;
  return {
    key: filingKey(symbol, link.url),
    symbol,
    label: labelOf(type, title),
    title,
    url: link.url,
    filedAt: filed,
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
      Type_of_Submission: field("Type_of_Submission"),
      Created: field("Created"),
      URL: { Url: field("Url"), Description: field("Description") },
    };
  });
}

function normalize(rows: Record<string, unknown>[], now: number): FilingNotice[] {
  const cutoff = now - WEEK_MS;
  const seen = new Set<string>();
  return rows
    .map(fromRecord)
    .filter((row): row is FilingNotice => !!row && row.filedAt.getTime() >= cutoff && !seen.has(row.key) && !!seen.add(row.key))
    .sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime());
}

async function load(now: number): Promise<FilingNotice[]> {
  const since = new Date(now - WEEK_MS).toISOString();
  const url = new URL(LIST);
  url.searchParams.set("$select", "URL,Created,CompanyName,CompanySymbol,Type_of_Submission");
  url.searchParams.set("$orderby", "Created desc");
  url.searchParams.set("$filter", `Created ge datetime'${since}'`);
  url.searchParams.set("$top", "80");

  const res = await fetch(url, {
    headers: { Accept: "application/json;odata=verbose" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NGX filings request failed (${res.status})`);
  const body = await res.text();
  const rows = body.trim().startsWith("<") ? recordsFromXml(body) : recordsFromJson(JSON.parse(body) as unknown);
  return normalize(rows, now);
}

export function getFilings(now = Date.now()): Promise<FilingNotice[]> {
  if (memory && now < memory.expiresAt) return Promise.resolve(memory.filings);
  if (!inflight) {
    inflight = load(now)
      .then((filings) => {
        memory = { filings, expiresAt: now + 5 * 60 * 1000 };
        return filings;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function noticesFromBody(raw: unknown): FilingNotice[] {
  if (!Array.isArray(raw)) return [];
  const notices: FilingNotice[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { symbol?: unknown; title?: unknown; url?: unknown; filedAt?: unknown; label?: unknown };
    const symbol = textOf(row.symbol).toUpperCase();
    const url = textOf(row.url);
    const filedAt = new Date(textOf(row.filedAt));
    if (!/^[A-Z0-9.]{2,12}$/.test(symbol) || !allowedFilingUrl(url) || Number.isNaN(filedAt.getTime())) continue;
    const title = textOf(row.title) || symbol;
    notices.push({
      key: filingKey(symbol, url),
      symbol,
      label: textOf(row.label) || "Filing",
      title,
      url,
      filedAt,
    });
  }
  return notices.sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime());
}
