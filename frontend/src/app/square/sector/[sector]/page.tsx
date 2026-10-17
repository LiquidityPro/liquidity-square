"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Composer, EmptyState, PageHeader, PostFeed, SentimentBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchPosts, fetchSentiment } from "@/components/square/api";
import type { Post } from "@/components/square/data";
import { usePostList } from "@/components/square/use-post-list";
import { useMarketTape } from "@/components/square/use-market-tape";
import { formatSector, topMovers } from "@/lib/market/quotes";
import { PriceChange } from "@/components/square/price-change";

export default function SectorRoom() {
  const params = useParams();
  const raw = decodeURIComponent((params?.sector as string) ?? "").trim();
  const label = raw ? formatSector(raw) : "Sector";
  const { token, ready, publish } = useSquare();
  const { snapshot } = useMarketTape();
  const [bulls, setBulls] = useState(0);
  const [bears, setBears] = useState(0);

  const quotes = useMemo(
    () => (snapshot?.quotes ?? []).filter((quote) => quote.sector.trim().toLowerCase() === raw.toLowerCase()),
    [snapshot, raw],
  );
  const symbols = useMemo(() => quotes.map((quote) => quote.symbol), [quotes]);
  const movers = useMemo(() => topMovers(quotes, 5), [quotes]);

  useEffect(() => {
    if (!ready || !token || symbols.length === 0) return;
    let cancelled = false;
    fetchSentiment(token, symbols.slice(0, 60), "session", snapshot?.sessionDate)
      .then((rows) => {
        if (cancelled) return;
        const totals = rows.reduce(
          (sum, row) => ({ bulls: sum.bulls + row.bulls, bears: sum.bears + row.bears }),
          { bulls: 0, bears: 0 },
        );
        setBulls(totals.bulls);
        setBears(totals.bears);
      })
      .catch(() => {
        if (!cancelled) {
          setBulls(0);
          setBears(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, ready, symbols, snapshot?.sessionDate]);

  const fetchPage = useCallback(
    (authToken: string, cursor: string | null) => fetchPosts(authToken, { sector: raw, cursor }),
    [raw],
  );
  const inSector = useCallback(
    (post: Post) => !post.parentId && post.tickers.some((ticker) => symbols.includes(ticker)),
    [symbols],
  );
  const list = usePostList({ key: `sector:${raw.toLowerCase()}`, fetchPage, includeRecent: inSector });
  const total = bulls + bears;
  const pctBull = total > 0 ? Math.round((bulls / total) * 100) : 0;

  return (
    <>
      <PageHeader title={label} subtitle="Sector room" back />
      <section className="border-b px-4 py-4">
        <p className="text-sm text-muted-foreground">
          {quotes.length} {quotes.length === 1 ? "name" : "names"} in the session
        </p>
        {total > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Session sentiment</h2>
              <p className="font-mono text-xs text-muted-foreground">
                {bulls} bull · {bears} bear
              </p>
            </div>
            <SentimentBar bull={pctBull} label={`${label} session`} />
          </div>
        )}
        {(movers.gainers.length > 0 || movers.losers.length > 0) && (
          <ul className="mt-4 divide-y overflow-hidden rounded-xl border">
            {[...movers.gainers, ...movers.losers].slice(0, 8).map((quote) => (
              <li key={quote.symbol}>
                <Link href={`/square/${quote.symbol}`} className="flex items-center justify-between px-3 py-2 hover:bg-card/60">
                  <span className="font-mono font-semibold">${quote.symbol}</span>
                  <PriceChange changePct={quote.changePct} className="font-mono text-sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Composer
        persistDrafts
        onPost={(body, stance, extras) => publish(body, stance, null, extras)}
        placeholder={`What's your read on ${label}?`}
      />
      <PostFeed
        list={list}
        empty={<EmptyState title="Quiet in this sector" body={`Tag a ${label} name to start the room.`} />}
      />
    </>
  );
}
