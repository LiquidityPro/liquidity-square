"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, Verified } from "./avatar";
import { cn } from "@/lib/utils";
import { SUGGESTED, TRENDING, TOP_MOVERS, compact, getTickerData } from "./data";

/* Right rail                                                          */
/* ------------------------------------------------------------------ */

export function SentimentBar({ bull, label }: { bull: number; label: string }) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full" role="img" aria-label={`${label}: ${bull}% bullish, ${100 - bull}% bearish (illustrative)`}>
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
  onTicker,
  following,
  onToggleFollow,
  activeTicker,
}: {
  onTicker: (t: string) => void;
  following: Set<string>;
  onToggleFollow: (handle: string) => void;
  activeTicker?: string;
}) {
  const [q, setQ] = useState("");
  const tickerData = activeTicker ? getTickerData(activeTicker) : null;

  return (
    <aside className="sticky top-10 hidden h-[calc(100dvh-2.5rem)] w-[340px] shrink-0 flex-col overflow-hidden py-2 pl-6 lg:flex">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const t = q.trim().replace(/^\$/, "").toUpperCase();
          if (t) onTicker(t);
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
          <h2 className="mb-4 text-lg font-bold">About ${activeTicker}</h2>
          
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
                <p className="text-sm font-medium leading-snug group-hover:underline">
                  {newsItem.headline}
                </p>
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
            <span className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground">Illustrative</span>
          </div>
          <ol>
            {TRENDING.map((t, i) => (
              <li key={t.ticker}>
                <button
                  type="button"
                  onClick={() => onTicker(t.ticker)}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-background/60"
                >
                  <p className="label-mono !text-[0.62rem] text-muted-foreground">
                    {i + 1} · {t.sector} · Trending
                  </p>
                  <p className="mt-0.5 font-mono font-semibold">${t.ticker}</p>
                  <p className="mb-2 text-xs text-muted-foreground">{t.posts}</p>
                  <SentimentBar bull={t.bull} label={`$${t.ticker} sentiment`} />
                </button>
              </li>
            ))}
          </ol>
        </section>
        
        <section className="rounded-2xl border bg-card pb-2">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <h2 className="text-xl font-bold">Top Movers</h2>
            <span className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground">Today</span>
          </div>
          
          <div className="px-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary opacity-80">Gainers</h3>
            <ul className="mb-4 space-y-1">
              {TOP_MOVERS.gainers.map(m => (
                <motion.li 
                  key={m.ticker} 
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-background/80"
                  onClick={() => onTicker(m.ticker)}
                >
                  <div>
                    <button type="button" className="font-mono font-semibold text-sm">
                      ${m.ticker}
                    </button>
                    <p className="font-mono text-xs text-muted-foreground">₦{m.price.toFixed(2)}</p>
                  </div>
                  <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary shadow-sm border border-primary/20">+{m.change}%</span>
                </motion.li>
              ))}
            </ul>

            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-bear opacity-80">Losers</h3>
            <ul className="space-y-1">
              {TOP_MOVERS.losers.map(m => (
                <motion.li 
                  key={m.ticker} 
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-background/80"
                  onClick={() => onTicker(m.ticker)}
                >
                  <div>
                    <button type="button" className="font-mono font-semibold text-sm">
                      ${m.ticker}
                    </button>
                    <p className="font-mono text-xs text-muted-foreground">₦{m.price.toFixed(2)}</p>
                  </div>
                  <span className="rounded bg-bear/10 px-2 py-1 text-xs font-bold text-bear shadow-sm border border-bear/20">{m.change}%</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>
        </>
      )}

      <section className="rounded-2xl border bg-card pb-2">
        <h2 className="px-4 pb-1 pt-3 text-xl font-bold">Verified voices</h2>
        <ul>
          {SUGGESTED.map((a) => {
            const on = following.has(a.handle);
            return (
              <li key={a.handle} className="flex items-center gap-3 px-4 py-3">
                <Avatar author={a} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-semibold">
                    <span className="truncate">{a.name}</span>
                    {a.verified && <Verified />}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    @{a.handle} · {a.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFollow(a.handle)}
                  aria-pressed={on}
                  className={cn(
                    "group/follow min-h-9 min-w-[88px] rounded-full px-4 text-sm font-bold transition active:scale-[0.96]",
                    on
                      ? "border border-border text-foreground hover:border-bear hover:text-bear"
                      : "bg-foreground text-background hover:opacity-90",
                  )}
                >
                  {on ? (
                    <>
                      <span className="group-hover/follow:hidden">Following</span>
                      <span className="hidden group-hover/follow:inline">Unfollow</span>
                    </>
                  ) : (
                    "Follow"
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="label-mono text-primary">Preview</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The Square isn't open yet. Everything here is placeholder content.
        </p>
        <a
          href="/#join"
          className="mt-3 flex min-h-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground hover:opacity-90 active:scale-[0.96] transition"
        >
          Join the waitlist
        </a>
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

/* ------------------------------------------------------------------ */
