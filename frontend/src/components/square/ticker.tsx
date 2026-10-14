"use client";

import { LuX as X } from "react-icons/lu";
import { cn } from "@/lib/utils";
import type { TapeQuote } from "@/lib/market/tape";
import { formatChange, formatNaira, formatSession } from "@/lib/market/quotes";
import { useMarketTape } from "./use-market-tape";

export function TickerChip({ ticker, onClear }: { ticker: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 py-1 pl-3 pr-1 font-mono text-sm text-primary">
      ${ticker}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear $${ticker} filter`}
        className="grid size-6 place-items-center rounded-full hover:bg-primary/20"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function TickerTape() {
  const { snapshot, failed } = useMarketTape();

  const quotes = snapshot?.quotes ?? [];
  const sessionLabel = snapshot ? formatSession(snapshot.sessionDate) : failed ? "Unavailable" : "Loading";
  const sessionTitle = snapshot
    ? `NGX session ${snapshot.sessionDate}. Next refresh ${formatWhen(snapshot.refreshAt)} WAT.`
    : "NGX session";

  return (
    <div className="sticky top-0 z-50 flex border-b bg-background/65 text-sm shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/50">
      <div
        className="flex shrink-0 items-center gap-2 border-r px-3 font-mono text-xs"
        title={sessionTitle}
      >
        <span className="font-bold tracking-wide">NGX</span>
        <span className="text-muted-foreground">{sessionLabel}</span>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden py-2.5" aria-hidden={quotes.length > 0}>
        {quotes.length > 0 ? (
          <TapeRow quotes={quotes} />
        ) : (
          <p className="px-3 font-mono text-xs text-muted-foreground">
            {failed ? "Tape unavailable" : "Loading the session…"}
          </p>
        )}
      </div>
    </div>
  );
}

function TapeRow({ quotes }: { quotes: TapeQuote[] }) {
  const duration = Math.max(80, quotes.length * 2.4);

  return (
    <div className="animate-ticker flex w-max font-mono" style={{ animationDuration: `${duration}s` }}>
      {[0, 1].map((copyIndex) => (
        <div key={copyIndex} className="flex gap-8 pr-8">
          {quotes.map((item) => (
            <span key={`${copyIndex}-${item.symbol}`} className="flex items-center gap-2.5 px-2 py-0.5">
              <span className="font-bold opacity-90">${item.symbol}</span>
              <span className="font-medium opacity-75">₦{formatNaira(item.price)}</span>
              <span className={cn("font-bold", item.changePct >= 0 ? "text-primary" : "text-bear")}>
                {formatChange(item.changePct)}
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
