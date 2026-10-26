"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WeekFiling } from "@/lib/market/week";
import { relativeTime } from "./api";

export function WeekStrip({ symbol }: { symbol?: string }) {
  const [filings, setFilings] = useState<WeekFiling[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
    fetch(`/api/market/week${query}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("unavailable"))))
      .then((data: { filings?: WeekFiling[] }) => {
        if (!cancelled) setFilings(data.filings ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (failed || filings?.length === 0) return null;
  if (!filings) {
    return (
      <section data-tour="week" className="border-b px-4 py-3" aria-label="This week on NGX">
        <div className="h-16 animate-pulse rounded-xl bg-card" />
      </section>
    );
  }

  return (
    <section data-tour="week" className="border-b px-4 py-3" aria-label="This week on NGX">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">This week on NGX</h2>
        <p className="text-xs text-muted-foreground">Filings from the last 7 days</p>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {filings.map((filing) => (
          <li key={filing.id} className="min-w-52 max-w-64 shrink-0">
            <div className="rounded-xl border px-3 py-2">
              <p className="label-mono !text-[0.62rem] text-muted-foreground">
                {filing.label} · {relativeTime(filing.filedAt)}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold">
                <Link href={`/square/${filing.symbol}`} className="hover:underline">
                  ${filing.symbol}
                </Link>
              </p>
              <a href={filing.url} target="_blank" rel="noreferrer" className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground hover:underline">
                {filing.title}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
