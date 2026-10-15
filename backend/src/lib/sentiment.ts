import { Stance } from "@prisma/client";
import { prisma } from "./prisma";

export type StanceCounts = { bulls: number; bears: number };
export type SentimentWindow = "session" | "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SYMBOLS = 60;

export function lagosToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseSessionDate(raw: unknown, now = new Date()): string {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return lagosToday(now);
}

/** Midnight at the start of the NGX session, in West Africa Time (UTC+1, no daylight saving). */
export function windowStart(kind: SentimentWindow, sessionDate: string, now = new Date()): Date {
  if (kind === "week") return new Date(now.getTime() - 7 * DAY_MS);
  if (kind === "month") return new Date(now.getTime() - 30 * DAY_MS);
  const [year, month, day] = sessionDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 60 * 60 * 1000);
}

function empty(symbols: string[]): Record<string, StanceCounts> {
  const totals: Record<string, StanceCounts> = {};
  for (const symbol of symbols) totals[symbol] = { bulls: 0, bears: 0 };
  return totals;
}

function add(bucket: StanceCounts | undefined, stance: Stance | null) {
  if (!bucket || !stance) return;
  if (stance === Stance.bull) bucket.bulls += 1;
  else bucket.bears += 1;
}

/**
 * One voice per post with a stance, plus one voice per poll vote on a bull or bear option.
 * The author's own vote does not count again when their post already has a stance.
 */
export async function sentimentMap(symbols: string[], since: Date): Promise<Record<string, StanceCounts>> {
  const unique = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).slice(
    0,
    MAX_SYMBOLS,
  );
  const totals = empty(unique);
  if (unique.length === 0) return totals;

  const [posts, votes] = await Promise.all([
    prisma.post.findMany({
      where: {
        stance: { not: null },
        createdAt: { gte: since },
        tickers: { some: { symbol: { in: unique } } },
      },
      select: {
        stance: true,
        tickers: { where: { symbol: { in: unique } }, select: { symbol: true } },
      },
    }),
    prisma.pollVote.findMany({
      where: {
        createdAt: { gte: since },
        option: { stance: { not: null } },
        poll: { post: { tickers: { some: { symbol: { in: unique } } } } },
      },
      select: {
        userId: true,
        option: { select: { stance: true } },
        poll: {
          select: {
            post: {
              select: {
                authorId: true,
                stance: true,
                tickers: { where: { symbol: { in: unique } }, select: { symbol: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  for (const post of posts) {
    for (const ticker of post.tickers) add(totals[ticker.symbol], post.stance);
  }
  for (const vote of votes) {
    const post = vote.poll.post;
    if (vote.userId === post.authorId && post.stance) continue;
    for (const ticker of post.tickers) add(totals[ticker.symbol], vote.option.stance);
  }
  return totals;
}

export async function sentimentWindows(symbol: string, sessionDate: string, now = new Date()) {
  const [session, week, month] = await Promise.all([
    sentimentMap([symbol], windowStart("session", sessionDate, now)),
    sentimentMap([symbol], windowStart("week", sessionDate, now)),
    sentimentMap([symbol], windowStart("month", sessionDate, now)),
  ]);
  const zero = { bulls: 0, bears: 0 };
  return {
    session: session[symbol] ?? zero,
    week: week[symbol] ?? zero,
    month: month[symbol] ?? zero,
  };
}
