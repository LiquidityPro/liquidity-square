"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuSearch as Search } from "react-icons/lu";
import { UserRow } from "./user-row";
import { compact, type Author, type TickerSummary } from "./data";
import { fetchSuggested, fetchTickers } from "./api";
import { useSquare } from "./context";
import { useMarketTape } from "./use-market-tape";
import { formatChange, formatMove, formatNaira, formatSector, formatSession, moveNaira, topMovers } from "@/lib/market/quotes";
import type { TapeQuote } from "@/lib/market/tape";
import { cn } from "@/lib/utils";

/* Right rail                                                          */
/* ------------------------------------------------------------------ */

export function SentimentBar({ bull, label }: { bull: number; label: string }) {
  return (
    <div>
      <div
        className="flex h-2 overflow-hidden rounded-full"
        role="img"
        aria-label={`${label}: ${bull}% bullish, ${100 - bull}% bearish`}
      >
        <div className="bg-primary transition-[width] duration-700" style={{ width: `${bull}%` }} />
        <div className="bg-bear" style={{ width: `${100 - bull}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.7rem]">
        <span className="text-primary">Bull {bull}%</span>
        <span className="text-bear">Bear {100 - bull}%</span>
      </div>
    </div>
  );
}

export function RightRail({
  activeTicker,
  variant = "rail",
}: {
  activeTicker?: string;
  variant?: "rail" | "sheet";
}) {
  const router = useRouter();
  const { token, ready } = useSquare();
  const [q, setQ] = useState("");
  const [tickers, setTickers] = useState<TickerSummary[]>([]);
  const [suggested, setSuggested] = useState<Author[]>([]);
  const [railReady, setRailReady] = useState(false);
  const { snapshot, failed: tapeFailed } = useMarketTape();
  const symbol = activeTicker?.replace(/^\$/, "").toUpperCase() ?? "";
  const quote = useMemo(
    () => (symbol ? snapshot?.quotes.find((row) => row.symbol === symbol) ?? null : null),
    [snapshot, symbol],
  );

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setRailReady(true);
      return;
    }
    let cancelled = false;
    Promise.allSettled([
      fetchTickers(token, 7).then((rows) => {
        if (!cancelled) setTickers(rows);
      }),
      fetchSuggested(token, 5).then((users) => {
        if (!cancelled) setSuggested(users);
      }),
    ]).then((results) => {
      if (cancelled) return;
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(index === 0 ? "Failed to load trending tickers" : "Failed to load suggested users", result.reason);
        }
      });
      setRailReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token, ready]);

  function goSearch(raw: string) {
    const value = raw.trim();
    if (!value) return;
    const symbol = value.replace(/^\$/, "").toUpperCase();
    if (/^[A-Z]{2,12}$/.test(symbol)) router.push(`/square/${symbol}`);
    else router.push(`/square/explore?q=${encodeURIComponent(value)}`);
  }

  const trendingLoading = !railReady && tickers.length === 0;
  const trending = tickers.map((t) => ({
    ticker: t.symbol,
    sector: t.sector ?? "NGX",
    posts: `${compact(t.postCount)} posts`,
  }));
  const suggestionsLoading = !railReady && suggested.length === 0;
  const searchId = variant === "sheet" ? "square-search-sheet" : "square-search";

  return (
    <aside
      className={
        variant === "sheet"
          ? "flex h-full min-h-0 flex-col overflow-hidden px-4 pr-12 pt-4"
          : "sticky top-10 hidden h-[calc(100dvh-2.5rem)] w-[340px] shrink-0 flex-col overflow-hidden py-2 pl-6 lg:flex"
      }
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goSearch(q);
          setQ("");
        }}
        className="z-10 shrink-0 bg-background pb-3 pt-1"
      >
        <label htmlFor={searchId} className="sr-only">
          Search tickers
        </label>
        <div className="flex items-center gap-3 rounded-full border bg-card px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            id={searchId}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a ticker, e.g. MTNN"
            className="min-h-11 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </form>

      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {symbol ? (
          <TickerQuoteCard
            symbol={symbol}
            quote={quote}
            sessionDate={snapshot?.sessionDate}
            pending={!snapshot && !tapeFailed}
            failed={tapeFailed && !snapshot}
          />
        ) : (
            <section className="rounded-2xl border bg-card">
              <div className="flex items-center justify-between px-4 pb-1 pt-3">
                <h2 className="text-xl font-bold">Trending on NGX</h2>
                {tickers.length > 0 && (
                  <span className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground">
                    Live
                  </span>
                )}
              </div>
              {trendingLoading ? (
                <RailSkeleton rows={7} label="Loading trending tickers" />
              ) : trending.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Nothing trending yet.</p>
              ) : (
                <ol>
                  {trending.map((t, i) => (
                    <li key={t.ticker}>
                      <button
                        type="button"
                        onClick={() => router.push(`/square/${t.ticker}`)}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-background/60"
                      >
                        <p className="label-mono !text-[0.62rem] text-muted-foreground">
                          {i + 1} · {t.sector} · Trending
                        </p>
                        <p className="mt-0.5 font-mono font-semibold">${t.ticker}</p>
                        <p className="text-xs text-muted-foreground">{t.posts}</p>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
        )}

        <TopMoversCard quotes={snapshot?.quotes} sessionDate={snapshot?.sessionDate} failed={tapeFailed} />

        <section className="rounded-2xl border bg-card pb-2">
          <h2 className="px-4 pb-1 pt-3 text-xl font-bold">Who to follow</h2>
          {suggestionsLoading ? (
            <FollowSkeleton />
          ) : suggested.length > 0 ? (
            <ul>
              {suggested.map((a) => (
                <li key={a.id ?? a.handle}>
                  <UserRow author={a} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">No suggestions yet. Follow people from Explore.</p>
          )}
          <Link
            href="/square/explore"
            className="mx-4 mb-3 mt-1 flex min-h-9 items-center justify-center rounded-full text-sm font-semibold text-primary hover:bg-primary/10"
          >
            Show more
          </Link>
        </section>

        <nav className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-6 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
          <span>© {new Date().getFullYear()} Liquidity Pro</span>
        </nav>
      </div>
    </aside>
  );
}

function TickerQuoteCard({
  symbol,
  quote,
  sessionDate,
  pending,
  failed,
}: {
  symbol: string;
  quote: TapeQuote | null;
  sessionDate?: string;
  pending: boolean;
  failed: boolean;
}) {
  const up = (quote?.changePct ?? 0) > 0;
  const down = (quote?.changePct ?? 0) < 0;
  const tone = up ? "text-primary" : down ? "text-bear" : "text-muted-foreground";
  const sessionLabel = sessionDate ? formatSession(sessionDate) : failed ? "Unavailable" : "Loading";

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-lg font-bold">${symbol}</h2>
        <span
          className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground"
          title={sessionDate ? `NGX session ${sessionDate}` : "NGX session"}
        >
          {sessionLabel}
        </span>
      </div>
      {quote ? (
        <>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">₦{formatNaira(quote.price)}</p>
          <p className={cn("mt-1 font-mono text-sm font-semibold", tone)}>
            {quote.changePct === 0 ? (
              formatChange(quote.changePct)
            ) : (
              <>
                {formatMove(moveNaira(quote.price, quote.changePct))}
                <span className="ml-2">{formatChange(quote.changePct)}</span>
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{formatSector(quote.sector || "NGX")}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {pending ? "Loading the session…" : failed ? "Session unavailable." : `No NGX print for $${symbol} this session.`}
        </p>
      )}
    </section>
  );
}

export function TopMoversCard({
  quotes,
  sessionDate,
  failed,
  limit = 10,
}: {
  quotes?: TapeQuote[];
  sessionDate?: string;
  failed: boolean;
  limit?: number;
}) {
  const movers = useMemo(() => topMovers(quotes ?? [], limit), [quotes, limit]);
  const sessionLabel = sessionDate ? formatSession(sessionDate) : failed ? "Unavailable" : "Loading";

  return (
    <section className="rounded-2xl border bg-card pb-2">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h2 className="text-xl font-bold">Top Movers</h2>
        <span
          className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground"
          title={sessionDate ? `NGX session ${sessionDate}` : "NGX session"}
        >
          {sessionLabel}
        </span>
      </div>
      <MoverList
        label="Gainers"
        quotes={movers.gainers}
        tone="up"
        pending={!sessionDate && !failed}
        empty={sessionDate ? "No gainers yet." : "Session unavailable."}
      />
      <MoverList
        label="Losers"
        quotes={movers.losers}
        tone="down"
        pending={!sessionDate && !failed}
        empty={sessionDate ? "No losers yet." : "Session unavailable."}
      />
    </section>
  );
}

function RailSkeleton({ rows, label }: { rows: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4 px-4 py-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-2.5 w-28 animate-pulse rounded bg-background" />
          <div className="h-4 w-24 animate-pulse rounded bg-background" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-background" />
        </div>
      ))}
    </div>
  );
}

function FollowSkeleton() {
  return (
    <div role="status" aria-label="Loading suggestions" className="space-y-4 px-4 py-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-background" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-background" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-background" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MoverList({
  label,
  quotes,
  tone,
  empty,
  pending,
}: {
  label: string;
  quotes: TapeQuote[];
  tone: "up" | "down";
  empty: string;
  pending?: boolean;
}) {
  return (
    <div className="pb-2">
      <h3
        className={cn(
          "px-4 pb-1 pt-1 text-xs font-bold uppercase tracking-wider",
          tone === "up" ? "text-primary" : "text-bear",
        )}
      >
        {label}
        {quotes.length > 0 && quotes.length < 10 && (
          <span className="ml-2 font-mono text-[0.65rem] font-medium normal-case tracking-normal text-muted-foreground">
            {quotes.length} printed
          </span>
        )}
      </h3>
      {quotes.length === 0 ? (
        pending ? (
          <RailSkeleton rows={4} label={`Loading ${label.toLowerCase()}`} />
        ) : (
          <p className="px-4 py-2 text-sm text-muted-foreground">{empty}</p>
        )
      ) : (
        <ol>
          {quotes.map((quote) => (
            <li key={quote.symbol}>
              <MoverRow quote={quote} tone={tone} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MoverRow({ quote, tone }: { quote: TapeQuote; tone: "up" | "down" }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/square/${quote.symbol}`)}
      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-background/60"
    >
      <span className="font-mono text-sm font-semibold">${quote.symbol}</span>
      <span className="flex shrink-0 items-center gap-3 font-mono">
        <span className="text-xs text-muted-foreground">₦{formatNaira(quote.price)}</span>
        <span className={cn("text-xs font-bold", tone === "up" ? "text-primary" : "text-bear")}>
          {formatChange(quote.changePct)}
        </span>
      </span>
    </button>
  );
}
