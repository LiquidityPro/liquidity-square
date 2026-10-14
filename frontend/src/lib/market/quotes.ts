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
  return sector.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
