"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function PriceChange({ changePct, className }: { changePct: number; className?: string }) {
  const down = changePct < 0;
  const flat = changePct === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold",
        down ? "text-bear" : flat ? "text-muted-foreground" : "text-primary",
        className,
      )}
    >
      <svg viewBox="0 0 10 10" className="size-2.5 shrink-0" aria-hidden="true">
        {down ? <path d="M1 2h8L5 9Z" fill="currentColor" /> : <path d="M5 1 9 8H1Z" fill="currentColor" />}
      </svg>
      {Math.abs(changePct).toFixed(2)}%
    </span>
  );
}

export function QuoteLogo({ symbol, className }: { symbol: string; className?: string }) {
  const webp = `https://cdn.jsdelivr.net/gh/ngnmarket/ngx-logos/dist/webp/${symbol}.webp`;
  const png = `https://cdn.jsdelivr.net/gh/ngnmarket/ngx-logos/dist/png/${symbol}.png`;
  const [stage, setStage] = useState<"webp" | "png" | "none">("webp");
  const src = stage === "webp" ? webp : stage === "png" ? png : null;
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      className={cn("size-4 shrink-0 rounded-sm object-contain", className)}
      onError={() => setStage((current) => (current === "webp" ? "png" : "none"))}
    />
  );
}
