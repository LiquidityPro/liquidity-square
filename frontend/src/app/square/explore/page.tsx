"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LuSearch as Search } from "react-icons/lu";
import { EmptyState, PageHeader, PostCard, PostSkeleton, TabBar, UserRow } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchSuggested, fetchTickers, search, type SearchResults } from "@/components/square/api";
import { TRENDING, compact, type Author, type TickerSummary } from "@/components/square/data";
import { SentimentBar } from "@/components/square/right-rail";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fallbackTrends = useMemo(
    () =>
      TRENDING.map((t) => ({
        symbol: t.ticker,
        name: null,
        sector: t.sector,
        postCount: 0,
        postsLabel: t.posts,
        bull: t.bull,
      })),
    [],
  );

  const tickers = q ? (results?.tickers ?? []) : trending.length > 0 ? trending : fallbackTrends;
  const people = q ? (results?.users ?? []) : suggested;
  const posts = results?.posts ?? [];
  const emptySearch = !!q && !loading && !error && !tickers.length && !people.length && !posts.length;

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

      {loading && !results && trending.length === 0 && suggested.length === 0 ? (
        <PostSkeleton count={4} />
      ) : emptySearch ? (
        <EmptyState title="No matches" body={`Nothing on the floor for “${q}”. Try a ticker like MTNN.`} />
      ) : (
        <>
          {(tab === "top" || tab === "tickers") && tickers.length > 0 && (
            <section className={tab === "tickers" ? "" : "border-b"}>
              {tab === "top" && (
                <h2 className="px-4 pb-1 pt-4 text-xl font-bold">{q ? "Tickers" : "Trending on NGX"}</h2>
              )}
              <ol>
                {tickers.map((t, i) => (
                  <TickerResult key={t.symbol} ticker={t} rank={i + 1} />
                ))}
              </ol>
            </section>
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

          {tab === "tickers" && !tickers.length && (
            <EmptyState title={q ? "No tickers found" : "Quiet tape"} body="Tag a ticker like $DANGCEM in a post to start a room." />
          )}

          {tab === "top" && !q && !tickers.length && !people.length && (
            <EmptyState title="Nothing trending yet" body="Post with a $TICKER to get the floor moving." />
          )}
        </>
      )}
    </>
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
        className="w-full px-4 py-3 text-left transition-colors hover:bg-card/60"
      >
        <p className="label-mono !text-[0.62rem] text-muted-foreground">
          {rank} · {ticker.sector ?? "NGX"} · Trending
        </p>
        <p className="mt-0.5 font-mono font-semibold">${ticker.symbol}</p>
        {ticker.name && <p className="text-xs text-muted-foreground">{ticker.name}</p>}
        <p className="mb-2 text-xs text-muted-foreground">
          {ticker.postsLabel ?? `${compact(ticker.postCount)} posts`}
        </p>
        {ticker.bull != null && <SentimentBar bull={ticker.bull} label={`$${ticker.symbol} sentiment`} />}
      </button>
    </li>
  );
}
