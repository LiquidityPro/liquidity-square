import type { TapeQuote } from "./tape";

export function splitSession(quotes: TapeQuote[]) {
  const gainers: TapeQuote[] = [];
  const losers: TapeQuote[] = [];
  const unchanged: TapeQuote[] = [];

  for (const quote of quotes) {
    if (quote.changePct > 0) gainers.push(quote);
    else if (quote.changePct < 0) losers.push(quote);
    else unchanged.push(quote);
  }

  gainers.sort((a, b) => b.changePct - a.changePct || a.symbol.localeCompare(b.symbol));
  losers.sort((a, b) => a.changePct - b.changePct || a.symbol.localeCompare(b.symbol));
  unchanged.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return { gainers, losers, unchanged };
}

export function topMovers(quotes: TapeQuote[], limit = 10) {
  const { gainers, losers } = splitSession(quotes);
  return {
    gainers: gainers.slice(0, limit),
    losers: losers.slice(0, limit),
  };
}

export function formatNaira(price: number) {
  return price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatChange(changePct: number) {
  return `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
}

/** Naira move implied by the session percent, from the previous close. */
export function moveNaira(price: number, changePct: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(changePct) || changePct <= -100) return 0;
  if (changePct === 0) return 0;
  const previous = price / (1 + changePct / 100);
  return Math.round((price - previous) * 100) / 100;
}

export function formatMove(amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return `₦${formatNaira(0)}`;
  const sign = amount > 0 ? "+" : "-";
  return `${sign}₦${formatNaira(Math.abs(amount))}`;
}

export function formatCount(value: number) {
  return value.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

export function formatTurnover(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `₦${(value / 1_000_000).toFixed(2)}m`;
  return `₦${formatNaira(value)}`;
}

export function sectorPath(sector: string) {
  return `/square/sector/${encodeURIComponent(sector)}`;
}

export function formatSession(sessionDate: string) {
  const [year, month, day] = sessionDate.split("-").map(Number);
  if (!year || !month || !day) return sessionDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatSector(sector: string) {
  return sector
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 4 && word === word.toUpperCase()) return word;
      return word.toLowerCase().replace(/^[a-z]/, (letter) => letter.toUpperCase());
    })
    .join(" ");
}
