"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TRENDING, getTickerData } from "@/components/square/data";
import { Composer, PostCard, SentimentBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { cn } from "@/lib/utils";

export default function TickerRoom() {
  const params = useParams();
  const ticker = params?.ticker as string;
  const router = useRouter();
  const { posts, handlePost } = useSquare();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  
  const feed = useMemo(() => posts.filter((p) => p.tickers.includes(ticker)), [posts, ticker]);
  const trend = TRENDING.find((t) => t.ticker === ticker);

  const sentimentStats = useMemo(() => {
    let bulls = 0;
    let bears = 0;
    feed.forEach((p) => {
      if (p.stance === "bull") bulls++;
      else if (p.stance === "bear") bears++;
    });
    const total = bulls + bears || 1;
    return {
      bulls,
      bears,
      pctBull: Math.round((bulls / total) * 100),
      pctBear: Math.round((bears / total) * 100),
      total: bulls + bears,
    };
  }, [feed]);

  const initialTickerData = useMemo(() => getTickerData(ticker), [ticker]);
  const [livePrice, setLivePrice] = useState(initialTickerData.price);
  const [liveChange, setLiveChange] = useState(initialTickerData.change);
  const [flashColor, setFlashColor] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        setLivePrice(prev => {
          const move = prev * (Math.random() * 0.002);
          const isUp = Math.random() > 0.5;
          const next = isUp ? prev + move : prev - move;
          
          setLiveChange(c => isUp ? c + 0.05 : c - 0.05);
          setFlashColor(isUp ? "up" : "down");
          setTimeout(() => setFlashColor(null), 800);
          
          return next;
        });
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [ticker]);

  const isPositive = liveChange >= 0;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/65 px-4 py-3 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push("/square")}
            className="grid size-9 place-items-center rounded-full transition-colors hover:bg-card"
            aria-label="Back to The Square"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              ${ticker}
              <span className="text-sm font-normal text-muted-foreground">({feed.length} posts)</span>
            </h1>
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className={cn(
                "font-semibold transition-colors duration-300", 
                flashColor === "up" ? "text-primary" : flashColor === "down" ? "text-bear" : ""
              )}>
                ₦{livePrice.toFixed(2)}
              </span>
              <span className={cn(
                "rounded px-1.5 py-0.5 text-xs font-bold transition-all duration-300",
                isPositive ? "bg-primary/20 text-primary" : "bg-bear/20 text-bear",
                flashColor === "up" ? "bg-primary text-primary-foreground scale-105 shadow-[0_0_15px_-3px_var(--primary)]" : "",
                flashColor === "down" ? "bg-bear text-primary-foreground scale-105 shadow-[0_0_15px_-3px_var(--bear)]" : ""
              )}>
                {isPositive ? "+" : ""}{liveChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        <button className="rounded-full bg-foreground px-4 py-1.5 text-sm font-bold text-background transition-transform hover:opacity-90 active:scale-95">
          Follow
        </button>
      </header>

      {/* The Live Sentiment Poll Card */}
      <div className="border-b bg-card/50 px-4 py-6 animate-in fade-in">
        <h2 className="mb-4 font-display text-xl font-semibold">What's your move on ${ticker}?</h2>
        <SentimentBar bull={sentimentStats.total > 0 ? sentimentStats.pctBull : (trend?.bull ?? 50)} label={`$${ticker} sentiment`} />
        
        <div className="mt-6 flex justify-between gap-4">
          <button 
            onClick={() => {
              handlePost(`I'm aggressively buying $${ticker} here. The fundamentals are too good to ignore.`, "bull");
            }}
            className="flex flex-1 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
          >
            🐂 Bullish
          </button>
          <button 
            onClick={() => {
              handlePost(`I'm taking profits on $${ticker} and watching from the sidelines.`, "bear");
            }}
            className="flex flex-1 items-center justify-center rounded-lg border border-bear/20 bg-bear/10 py-3 text-sm font-bold text-bear transition-colors hover:bg-bear/20"
          >
            🐻 Bearish
          </button>
        </div>
      </div>

      <Composer ref={composerRef} onPost={handlePost} initialValue={`$${ticker} `} />

      {feed.length > 0 ? (
        feed.map((p) => (
          <PostCard 
            key={p.id} 
            post={p} 
            onTicker={(t) => router.push(`/square/${t}`)} 
          />
        ))
      ) : (
        <div className="px-8 py-16 text-center">
          <p className="font-display text-2xl font-bold">Quiet on the floor</p>
          <p className="mt-2 text-muted-foreground">Be the first to share a thesis on ${ticker}.</p>
        </div>
      )}
    </>
  );
}
