"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Composer, EmptyState, PageHeader, PostFeed, SentimentBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchPosts, fetchTicker, type TickerDetail } from "@/components/square/api";
import { TRENDING, getTickerData, type Post } from "@/components/square/data";
import { usePostList } from "@/components/square/use-post-list";
import { cn } from "@/lib/utils";

export default function TickerRoom() {
  const params = useParams();
  const ticker = ((params?.ticker as string) ?? "").replace(/^\$/, "").toUpperCase();
  const { token, ready, publish } = useSquare();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [detail, setDetail] = useState<TickerDetail | null>(null);
  const [followingTicker, setFollowingTicker] = useState(false);

  const fetchPage = useCallback(
    (t: string, cursor: string | null) => fetchPosts(t, { ticker, cursor }),
    [ticker],
  );
  const hasTicker = useCallback((p: Post) => p.tickers.includes(ticker), [ticker]);
  const list = usePostList({ key: `ticker:${ticker}`, fetchPage, includeRecent: hasTicker });

  useEffect(() => {
    if (!ready || !token || !ticker) return;
    let cancelled = false;
    fetchTicker(token, ticker)
      .then((t) => !cancelled && setDetail(t))
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [ticker, token, ready]);

  const trend = TRENDING.find((t) => t.ticker === ticker);
  const sentimentStats = useMemo(() => {
    let bulls = 0;
    let bears = 0;
    list.posts.forEach((p) => {
      if (p.stance === "bull") bulls++;
      else if (p.stance === "bear") bears++;
    });
    if (detail) {
      bulls = Math.max(bulls, detail.bulls);
      bears = Math.max(bears, detail.bears);
    }
    const total = bulls + bears;
    return {
      pctBull: total > 0 ? Math.round((bulls / total) * 100) : (trend?.bull ?? 50),
      total,
    };
  }, [list.posts, detail, trend]);

  const initialTickerData = useMemo(() => getTickerData(ticker), [ticker]);
  const [livePrice, setLivePrice] = useState(initialTickerData.price);
  const [liveChange, setLiveChange] = useState(initialTickerData.change);
  const [flashColor, setFlashColor] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    setLivePrice(initialTickerData.price);
    setLiveChange(initialTickerData.change);
    setFlashColor(null);
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        setLivePrice((prev) => {
          const move = prev * (Math.random() * 0.002);
          const isUp = Math.random() > 0.5;
          const next = isUp ? prev + move : prev - move;
          setLiveChange((c) => (isUp ? c + 0.05 : c - 0.05));
          setFlashColor(isUp ? "up" : "down");
          setTimeout(() => setFlashColor(null), 800);
          return next;
        });
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [ticker, initialTickerData.price, initialTickerData.change]);

  const isPositive = liveChange >= 0;
  const postCount = detail?.postCount ?? list.posts.length;

  return (
    <>
      <PageHeader
        title={`$${ticker}`}
        subtitle={`${postCount} posts`}
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
      >
        <div className="flex items-center gap-2 px-4 pb-3 font-mono text-sm">
          <span
            className={cn(
              "font-semibold transition-colors duration-300",
              flashColor === "up" ? "text-primary" : flashColor === "down" ? "text-bear" : "",
            )}
          >
            ₦{livePrice.toFixed(2)}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-bold transition-all duration-300",
              isPositive ? "bg-primary/20 text-primary" : "bg-bear/20 text-bear",
              flashColor === "up" && "scale-105 bg-primary text-primary-foreground shadow-[0_0_15px_-3px_var(--primary)]",
              flashColor === "down" && "scale-105 bg-bear text-primary-foreground shadow-[0_0_15px_-3px_var(--bear)]",
            )}
          >
            {isPositive ? "+" : ""}
            {liveChange.toFixed(2)}%
          </span>
        </div>
      </PageHeader>

      <div className="border-b bg-card/50 px-4 py-6 animate-in fade-in">
        <h2 className="mb-4 font-display text-xl font-semibold">What's your move on ${ticker}?</h2>
        <SentimentBar bull={sentimentStats.pctBull} label={`$${ticker} sentiment`} />

        <div className="mt-6 flex justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              void publish(`I'm aggressively buying $${ticker} here. The fundamentals are too good to ignore.`, "bull");
            }}
            className="flex flex-1 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
          >
            Bullish
          </button>
          <button
            type="button"
            onClick={() => {
              void publish(`I'm taking profits on $${ticker} and watching from the sidelines.`, "bear");
            }}
            className="flex flex-1 items-center justify-center rounded-lg border border-bear/20 bg-bear/10 py-3 text-sm font-bold text-bear transition-colors hover:bg-bear/20"
          >
            Bearish
          </button>
        </div>
      </div>

      <Composer
        key={ticker}
        ref={composerRef}
        onPost={(body, stance) => publish(body, stance)}
        initialValue={`$${ticker} `}
      />

      <PostFeed
        list={list}
        empty={<EmptyState title="Quiet on the floor" body={`Be the first to share a thesis on $${ticker}.`} />}
      />
    </>
  );
}
