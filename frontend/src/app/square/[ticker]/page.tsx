"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Composer, EmptyState, PageHeader, PostFeed, SentimentBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchPosts, fetchTicker, type TickerDetail } from "@/components/square/api";
import type { Post } from "@/components/square/data";
import { usePostList } from "@/components/square/use-post-list";
import { useMarketTape } from "@/components/square/use-market-tape";
import { formatChange, formatMove, formatNaira, formatSector, formatSession, moveNaira } from "@/lib/market/quotes";
import { cn } from "@/lib/utils";

export default function TickerRoom() {
  const params = useParams();
  const ticker = ((params?.ticker as string) ?? "").replace(/^\$/, "").toUpperCase();
  const { token, ready, publish } = useSquare();
  const { snapshot, failed: tapeFailed } = useMarketTape();
  const [detail, setDetail] = useState<TickerDetail | null>(null);
  const [followingTicker, setFollowingTicker] = useState(false);

  const fetchPage = useCallback(
    (t: string, cursor: string | null) => fetchPosts(t, { ticker, cursor }),
    [ticker],
  );
  const hasTicker = useCallback((p: Post) => !p.parentId && p.tickers.includes(ticker), [ticker]);
  const list = usePostList({ key: `ticker:${ticker}`, fetchPage, includeRecent: hasTicker });

  useEffect(() => {
    setDetail(null);
    setFollowingTicker(false);
  }, [ticker]);

  useEffect(() => {
    if (!ready || !token || !ticker) return;
    let cancelled = false;
    fetchTicker(token, ticker)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, token, ready]);

  const quote = useMemo(
    () => snapshot?.quotes.find((row) => row.symbol === ticker) ?? null,
    [snapshot, ticker],
  );
  const tapePending = !snapshot && !tapeFailed;

  const sentiment = useMemo(() => {
    const fromPosts = list.posts.reduce(
      (counts, post) => {
        if (post.stance === "bull") counts.bulls += 1;
        else if (post.stance === "bear") counts.bears += 1;
        return counts;
      },
      { bulls: 0, bears: 0 },
    );
    const bulls = detail ? detail.bulls : fromPosts.bulls;
    const bears = detail ? detail.bears : fromPosts.bears;
    const total = bulls + bears;
    return {
      bulls,
      bears,
      total,
      pctBull: total > 0 ? Math.round((bulls / total) * 100) : 0,
    };
  }, [list.posts, detail]);

  const company = detail?.name && detail.name.toUpperCase() !== ticker ? detail.name : null;
  const rawSector = quote?.sector || detail?.sector;
  const sector = rawSector ? formatSector(rawSector) : "NGX";
  const postCount = detail ? detail.postCount : list.loading || list.error ? null : list.posts.length;
  const up = (quote?.changePct ?? 0) > 0;
  const down = (quote?.changePct ?? 0) < 0;
  const tone = up ? "text-primary" : down ? "text-bear" : "text-muted-foreground";

  return (
    <>
      <PageHeader
        title={`$${ticker}`}
        subtitle={company ?? undefined}
        back
        action={
          <button
            type="button"
            onClick={() => setFollowingTicker((v) => !v)}
            aria-pressed={followingTicker}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold transition-transform active:scale-95",
              followingTicker
                ? "border border-border text-foreground hover:border-bear hover:text-bear"
                : "bg-foreground text-background hover:opacity-90",
            )}
          >
            {followingTicker ? "Following" : "Follow"}
          </button>
        }
      />

      <section className="border-b px-4 py-5" aria-label={`${ticker} quote`}>
        {quote ? (
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-muted-foreground">{sector}</p>
              <p className="mt-2 font-mono text-4xl font-semibold tracking-tight">₦{formatNaira(quote.price)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn("font-mono text-lg font-semibold", tone)}>{formatChange(quote.changePct)}</p>
              {quote.changePct !== 0 && (
                <p className={cn("mt-0.5 font-mono text-sm", tone)}>{formatMove(moveNaira(quote.price, quote.changePct))}</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground">{sector}</p>
            {tapePending ? (
              <div className="mt-3 h-10 w-40 animate-pulse rounded-md bg-card" aria-hidden="true" />
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {tapeFailed ? "The NGX session is unavailable right now." : `No NGX print for $${ticker} this session.`}
              </p>
            )}
            {tapePending && <p className="sr-only">Loading the session price</p>}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {snapshot?.sessionDate ? `NGX close · ${formatSession(snapshot.sessionDate)}` : "NGX close"}
          {postCount != null && (
            <>
              <span className="mx-1.5">·</span>
              {postCount} {postCount === 1 ? "post" : "posts"}
            </>
          )}
        </p>

        {sentiment.total > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold">Sentiment</h2>
              <p className="font-mono text-xs text-muted-foreground">
                {sentiment.bulls} bull · {sentiment.bears} bear
              </p>
            </div>
            <SentimentBar bull={sentiment.pctBull} label={`$${ticker} posts`} />
          </div>
        )}
      </section>

      <Composer
        key={ticker}
        onPost={(body, stance) => publish(body, stance)}
        initialValue={`$${ticker} `}
        placeholder={`What's your read on $${ticker}?`}
      />

      <PostFeed
        list={list}
        empty={<EmptyState title="Quiet on the floor" body={`Be the first to share a read on $${ticker}.`} />}
      />
    </>
  );
}
