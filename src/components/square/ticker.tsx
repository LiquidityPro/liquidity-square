"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TRENDING, getTickerData } from "./data";

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

export function TickerTape() {
  const items = TRENDING.map((t) => {
    const data = getTickerData(t.ticker);
    return { ticker: t.ticker, price: data.price, change: data.change };
  });

  // Duplicate for seamless infinite scroll
  const tape = [...items, ...items, ...items];

  return (
    <div className="sticky top-0 z-50 overflow-hidden border-b bg-background/65 py-2.5 text-sm backdrop-blur-2xl backdrop-saturate-150 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] supports-[backdrop-filter]:bg-background/50" aria-hidden="true">
      <div className="animate-ticker flex w-max gap-8 font-mono">
        {tape.map((item, i) => (
          <motion.div 
            key={i} 
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-0.5 transition-colors hover:bg-background/40"
          >
            <span className="font-bold opacity-90">${item.ticker}</span>
            <span className="font-medium opacity-75">₦{item.price.toFixed(2)}</span>
            <span className={cn(
              "font-bold drop-shadow-sm",
              item.change >= 0 ? "text-primary" : "text-bear"
            )}>
              {item.change >= 0 ? "+" : ""}{item.change}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

