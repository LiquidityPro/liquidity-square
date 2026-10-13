"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuSearch as Search } from "react-icons/lu";
import { motion } from "framer-motion";
import { UserRow } from "./user-row";
import { TRENDING, TOP_MOVERS, compact, getTickerData, type Author, type TickerSummary } from "./data";
import { fetchSuggested, fetchTickers } from "./api";
import { useSquare } from "./context";

/* Right rail                                                          */
/* ------------------------------------------------------------------ */

export function SentimentBar({ bull, label }: { bull: number; label: string }) {
  return (
    <div>
      <div
        className="flex h-2 overflow-hidden rounded-full"
        role="img"
        aria-label={`${label}: ${bull}% bullish, ${100 - bull}% bearish (illustrative)`}
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

export function RightRail({ activeTicker }: { activeTicker?: string }) {
  const router = useRouter();
  const { token, ready } = useSquare();
  const [q, setQ] = useState("");
  const [tickers, setTickers] = useState<TickerSummary[]>([]);
  const [suggested, setSuggested] = useState<Author[]>([]);
  const tickerData = activeTicker ? getTickerData(activeTicker) : null;

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    fetchTickers(token, 7)
      .then((rows) => !cancelled && setTickers(rows))
      .catch((err) => console.error("Failed to load trending tickers", err));
    fetchSuggested(token, 5)
      .then((users) => !cancelled && setSuggested(users))
      .catch((err) => console.error("Failed to load suggested users", err));
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

  const trending = tickers.length
    ? tickers.map((t) => ({
        ticker: t.symbol,
        sector: t.sector ?? "NGX",
        posts: `${compact(t.postCount)} posts`,
        bull: null as number | null,
      }))
    : TRENDING.map((t) => ({ ...t, bull: t.bull as number | null }));

  return (
    <aside className="sticky top-10 hidden h-[calc(100dvh-2.5rem)] w-[340px] shrink-0 flex-col overflow-hidden py-2 pl-6 lg:flex">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goSearch(q);
          setQ("");
        }}
        className="z-10 shrink-0 bg-background pb-3 pt-1"
      >
        <label htmlFor="square-search" className="sr-only">
          Search tickers
        </label>
        <div className="flex items-center gap-3 rounded-full border bg-card px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            id="square-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a ticker, e.g. MTNN"
            className="min-h-11 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </form>

      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {activeTicker && tickerData ? (
          <section className="rounded-2xl border bg-card p-4 animate-in fade-in slide-in-from-right-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">About ${activeTicker}</h2>
              <span className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground">
                Illustrative
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Market Cap</p>
                <p className="font-mono font-medium">{tickerData.marketCap}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">P/E Ratio</p>
                <p className="font-mono font-medium">{tickerData.peRatio}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="font-mono font-medium">{tickerData.volume}</p>
              </div>
            </div>

            <h3 className="mb-3 mt-6 text-sm font-bold text-muted-foreground">Recent Headlines</h3>
            <ul className="space-y-4">
              {tickerData.news.map((newsItem, idx) => (
                <li key={idx} className="group cursor-pointer">
                  <p className="text-sm font-medium leading-snug group-hover:underline">{newsItem.headline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {newsItem.source} · {newsItem.time}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border bg-card">
              <div className="flex items-center justify-between px-4 pb-1 pt-3">
                <h2 className="text-xl font-bold">Trending on NGX</h2>
                <span className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground">
                  {tickers.length ? "Live" : "Illustrative"}
                </span>
              </div>
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
                      <p className="mb-2 text-xs text-muted-foreground">{t.posts}</p>
                      {t.bull != null && <SentimentBar bull={t.bull} label={`$${t.ticker} sentiment`} />}
                    </button>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border bg-card pb-2">
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <h2 className="text-xl font-bold">Top Movers</h2>
                <span className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground">
                  Illustrative
                </span>
              </div>

              <div className="px-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary opacity-80">Gainers</h3>
                <ul className="mb-4 space-y-1">
                  {TOP_MOVERS.gainers.map((m) => (
                    <MoverRow key={m.ticker} ticker={m.ticker} price={m.price} change={m.change} up />
                  ))}
                </ul>

                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-bear opacity-80">Losers</h3>
                <ul className="space-y-1">
                  {TOP_MOVERS.losers.map((m) => (
                    <MoverRow key={m.ticker} ticker={m.ticker} price={m.price} change={m.change} />
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}

        <section className="rounded-2xl border bg-card pb-2">
          <h2 className="px-4 pb-1 pt-3 text-xl font-bold">Who to follow</h2>
          {suggested.length > 0 ? (
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

function MoverRow({
  ticker,
  price,
  change,
  up,
}: {
  ticker: string;
  price: number;
  change: number;
  up?: boolean;
}) {
  const router = useRouter();
  return (
    <motion.li
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-background/80"
      onClick={() => router.push(`/square/${ticker}`)}
    >
      <div>
        <button type="button" className="font-mono text-sm font-semibold">
          ${ticker}
        </button>
        <p className="font-mono text-xs text-muted-foreground">₦{price.toFixed(2)}</p>
      </div>
      <span
        className={
          up
            ? "rounded border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary shadow-sm"
            : "rounded border border-bear/20 bg-bear/10 px-2 py-1 text-xs font-bold text-bear shadow-sm"
        }
      >
        {up ? "+" : ""}
        {change}%
      </span>
    </motion.li>
  );
}
