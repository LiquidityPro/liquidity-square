"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LuSearch as Search } from "react-icons/lu";
import { EmptyState, PageHeader, PostCard, PostSkeleton, TabBar, UserRow } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchSuggested, fetchTickers, search, type SearchResults } from "@/components/square/api";
import { compact, type Author, type TickerSummary } from "@/components/square/data";
import { useMarketTape } from "@/components/square/use-market-tape";
import { formatNaira, formatSector, formatSession, splitSession } from "@/lib/market/quotes";
import { PriceChange, QuoteLogo } from "@/components/square/price-change";
import type { TapeQuote } from "@/lib/market/tape";

type Tab = "top" | "people" | "tickers";
const TABS: { id: Tab; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "people", label: "People" },
  { id: "tickers", label: "Tickers" },
];

export default function ExplorePage() {
  return (
    <Suspense fallback={<PostSkeleton count={4} />}>
      <Explore />
    </Suspense>
  );
}

function Explore() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const { token, ready } = useSquare();

  const [draft, setDraft] = useState(initial);
  const [q, setQ] = useState(initial);
  const [tab, setTab] = useState<Tab>("top");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [trending, setTrending] = useState<TickerSummary[]>([]);
  const [suggested, setSuggested] = useState<Author[]>([]);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const { snapshot, failed: tapeFailed } = useMarketTape();

  useEffect(() => {
    setDraft(initial);
    setQ(initial);
  }, [initial]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = draft.trim();
      setQ(next);
      const url = next ? `/square/explore?q=${encodeURIComponent(next)}` : "/square/explore";
      router.replace(url, { scroll: false });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draft, router]);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;

    if (!q) {
      setLoading(true);
      Promise.all([fetchTickers(token, 10), fetchSuggested(token, 8)])
        .then(([tickers, users]) => {
          if (cancelled) return;
          setTrending(tickers);
          setSuggested(users);
          setResults(null);
          setError(null);
        })
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load explore"))
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    search(token, q)
      .then((res) => {
        if (cancelled) return;
        setResults(res);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Search failed"))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [q, token, ready]);

  const tickers = q ? (results?.tickers ?? []) : trending;
  const taggedTickers = q ? (results?.tickers ?? []) : trending;
  const people = q ? (results?.users ?? []) : suggested;
  const posts = results?.posts ?? [];
  const listed = useMemo(() => {
    const quotes = snapshot?.quotes ?? [];
    if (!q) return quotes;
    const needle = q.replace(/^\$/, "").toUpperCase();
    return quotes.filter((quote) => quote.symbol.includes(needle));
  }, [snapshot, q]);
  const emptySearch = !!q && !loading && !error && !tickers.length && !people.length && !posts.length && listed.length === 0;

  return (
    <>
      <PageHeader title="Explore">
        <div className="px-4 pb-3">
          <label htmlFor="square-explore-search" className="sr-only">
            Search The Square
          </label>
          <div className="flex items-center gap-3 rounded-full border bg-card px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              id="square-explore-search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search tickers, people, or posts"
              className="min-h-11 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
        <TabBar tabs={TABS} value={tab} onChange={setTab} label="Explore" />
      </PageHeader>

      {error && (
        <p role="alert" className="border-b border-bear/30 bg-bear/10 px-4 py-2 text-sm text-bear">
          {error}
        </p>
      )}

      {loading && !results && trending.length === 0 && suggested.length === 0 && !snapshot ? (
        <PostSkeleton count={4} />
      ) : emptySearch ? (
        <EmptyState title="No matches" body={`Nothing on the floor for “${q}”. Try a ticker like MTNN.`} />
      ) : (
        <>
          {tab === "top" && tickers.length > 0 && (
            <section className="border-b">
              <h2 className="px-4 pb-1 pt-4 text-xl font-bold">{q ? "Tickers" : "Trending on NGX"}</h2>
              <ol>
                {tickers.map((t, i) => (
                  <TickerResult key={t.symbol} ticker={t} rank={i + 1} />
                ))}
              </ol>
            </section>
          )}

          {tab === "tickers" && (
            <>
              <section className="border-b">
                <h2 className="px-4 pb-1 pt-4 text-xl font-bold">{q ? "Trending matches" : "Trending on NGX"}</h2>
                {taggedTickers.length > 0 ? (
                  <ol>
                    {taggedTickers.map((t, i) => (
                      <TickerResult key={t.symbol} ticker={t} rank={i + 1} />
                    ))}
                  </ol>
                ) : (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    {loading && !q
                      ? "Loading trending…"
                      : q
                        ? "No tagged tickers match that search."
                        : "No tagged tickers yet. The board below is the full NGX list."}
                  </p>
                )}
              </section>
              <ListedTickers quotes={listed} sessionDate={snapshot?.sessionDate} failed={tapeFailed} query={q} />
            </>
          )}

          {(tab === "top" || tab === "people") && people.length > 0 && (
            <section className={tab === "people" ? "" : "border-b"}>
              {tab === "top" && <h2 className="px-4 pb-1 pt-4 text-xl font-bold">{q ? "People" : "Who to follow"}</h2>}
              <ul>
                {people.map((author) => (
                  <li key={author.id ?? author.handle}>
                    <UserRow author={author} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "top" && q && posts.length > 0 && (
            <section>
              <h2 className="px-4 pb-1 pt-4 text-xl font-bold">Posts</h2>
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </section>
          )}

          {tab === "people" && !people.length && (
            <EmptyState
              title={q ? "No people found" : "No one to suggest yet"}
              body={q ? "Try a name or the start of an email." : "As more traders join, they'll show up here."}
            />
          )}


          {tab === "top" && !q && !tickers.length && !people.length && (
            <EmptyState title="Nothing trending yet" body="Post with a $TICKER to get the floor moving." />
          )}
        </>
      )}
    </>
  );
}

function ListedTickers({
  quotes,
  sessionDate,
  failed,
  query,
}: {
  quotes: TapeQuote[];
  sessionDate?: string;
  failed: boolean;
  query: string;
}) {
  let message = "Loading the session…";
  if (sessionDate && query) message = "No listed ticker matches that search.";
  else if (sessionDate) message = "No names in this session.";
  else if (failed) message = "Session unavailable.";

  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-4">
        <h2 className="text-xl font-bold">{query ? "Listed matches" : "All tickers"}</h2>
        {sessionDate && (
          <span
            className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground"
            title={`NGX session ${sessionDate}`}
          >
            {formatSession(sessionDate)}
          </span>
        )}
      </div>
      {quotes.length > 0 ? (
        <SessionGroups quotes={quotes} />
      ) : (
        <p className="px-4 py-6 text-sm text-muted-foreground">{message}</p>
      )}
    </section>
  );
}

function SessionGroups({ quotes }: { quotes: TapeQuote[] }) {
  const { gainers, losers, unchanged } = splitSession(quotes);
  const groups = [
    { label: "Gainers", quotes: gainers, tone: "up" as const },
    { label: "Losers", quotes: losers, tone: "down" as const },
    { label: "Unchanged", quotes: unchanged, tone: "flat" as const },
  ];

  return (
    <div>
      {groups.map((group) => (
        <section key={group.label} className="border-b last:border-b-0">
          <h3
            className={
              group.tone === "up"
                ? "px-4 pb-1 pt-4 text-sm font-bold uppercase tracking-wider text-primary"
                : group.tone === "down"
                  ? "px-4 pb-1 pt-4 text-sm font-bold uppercase tracking-wider text-bear"
                  : "px-4 pb-1 pt-4 text-sm font-bold uppercase tracking-wider text-muted-foreground"
            }
          >
            {group.label}
            <span className="ml-2 font-mono text-xs font-medium opacity-70">{group.quotes.length}</span>
          </h3>
          {group.quotes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {group.tone === "up" ? "No gainers yet." : group.tone === "down" ? "No losers yet." : "None in this group."}
            </p>
          ) : (
            <ol>
              {group.quotes.map((quote) => (
                <li key={quote.symbol} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 64px" }}>
                  <MarketTickerRow quote={quote} />
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}

function MarketTickerRow({ quote }: { quote: TapeQuote }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/square/${quote.symbol}`)}
      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-card/60"
    >
      <span>
        <span className="label-mono !text-[0.62rem] text-muted-foreground">{formatSector(quote.sector || "NGX")}</span>
        <span className="mt-0.5 block font-mono font-semibold">${quote.symbol}</span>
      </span>
      <span className="text-right">
        <span className="block font-mono text-sm">₦{formatNaira(quote.price)}</span>
        <PriceChange changePct={quote.changePct} className="font-mono text-xs" />
      </span>
    </button>
  );
}

function TickerResult({
  ticker,
  rank,
}: {
  ticker: TickerSummary & { postsLabel?: string; bull?: number };
  rank: number;
}) {
  const router = useRouter();
  return (
    <li>
      <button
        type="button"
        onClick={() => router.push(`/square/${ticker.symbol}`)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-card/60"
      >
        <QuoteLogo symbol={ticker.symbol} className="size-8 rounded-md" />
        <span className="min-w-0">
          <p className="label-mono !text-[0.62rem] text-muted-foreground">
            {rank} · {ticker.sector ?? "NGX"} · Trending
          </p>
          <p className="mt-0.5 font-mono font-semibold">${ticker.symbol}</p>
          {ticker.name && <p className="truncate text-xs text-muted-foreground">{ticker.name}</p>}
          <p className="text-xs text-muted-foreground">
            {ticker.postsLabel ?? `${compact(ticker.postCount)} posts`}
          </p>
        </span>
      </button>
    </li>
  );
}
