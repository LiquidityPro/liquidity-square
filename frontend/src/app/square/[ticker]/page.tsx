"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Composer, EmptyState, PageHeader, PostFeed, SentimentBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import {
  deleteAlert,
  fetchAlert,
  fetchPosts,
  fetchTicker,
  saveAlert,
  setWatching,
  type TickerDetail,
} from "@/components/square/api";
import type { Post, PriceAlert } from "@/components/square/data";
import { usePostList } from "@/components/square/use-post-list";
import { useMarketTape } from "@/components/square/use-market-tape";
import { WeekStrip } from "@/components/square/week-strip";
import {
  formatCount,
  formatMove,
  formatNaira,
  formatSector,
  formatSession,
  formatTurnover,
  moveNaira,
  sectorPath,
} from "@/lib/market/quotes";
import { cn } from "@/lib/utils";
import { PriceChange } from "@/components/square/price-change";

type WindowId = "session" | "week" | "month";
const WINDOWS: { id: WindowId; label: string }[] = [
  { id: "session", label: "Session" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
];

export default function TickerRoom() {
  const params = useParams();
  const ticker = ((params?.ticker as string) ?? "").replace(/^\$/, "").toUpperCase();
  const { token, ready, publish } = useSquare();
  const { snapshot, failed: tapeFailed } = useMarketTape();
  const [detail, setDetail] = useState<TickerDetail | null>(null);
  const [watching, setWatchingState] = useState(false);
  const [watchPending, setWatchPending] = useState(false);
  const [windowId, setWindowId] = useState<WindowId>("session");

  const fetchPage = useCallback(
    (authToken: string, cursor: string | null) => fetchPosts(authToken, { ticker, cursor }),
    [ticker],
  );
  const hasTicker = useCallback((post: Post) => !post.parentId && post.tickers.includes(ticker), [ticker]);
  const list = usePostList({ key: `ticker:${ticker}`, fetchPage, includeRecent: hasTicker });

  useEffect(() => {
    setDetail(null);
    setWatchingState(false);
    setWindowId("session");
  }, [ticker]);

  useEffect(() => {
    if (!ready || !token || !ticker) return;
    let cancelled = false;
    fetchTicker(token, ticker, snapshot?.sessionDate)
      .then((next) => {
        if (cancelled) return;
        setDetail(next);
        setWatchingState(next.watchedByMe);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, token, ready, snapshot?.sessionDate]);

  const quote = useMemo(
    () => snapshot?.quotes.find((row) => row.symbol === ticker) ?? null,
    [snapshot, ticker],
  );
  const tapePending = !snapshot && !tapeFailed;

  const sentiment = useMemo(() => {
    const fromDetail = detail?.sentiment?.[windowId];
    if (fromDetail) return fromDetail;
    if (windowId !== "session") return { bulls: 0, bears: 0 };
    return list.posts.reduce(
      (counts, post) => {
        if (post.stance === "bull") counts.bulls += 1;
        else if (post.stance === "bear") counts.bears += 1;
        return counts;
      },
      { bulls: 0, bears: 0 },
    );
  }, [detail, windowId, list.posts]);
  const sentimentTotal = sentiment.bulls + sentiment.bears;
  const pctBull = sentimentTotal > 0 ? Math.round((sentiment.bulls / sentimentTotal) * 100) : 0;

  const company = detail?.name && detail.name.toUpperCase() !== ticker ? detail.name : null;
  const rawSector = quote?.sector || detail?.sector;
  const sector = rawSector ? formatSector(rawSector) : "NGX";
  const postCount = detail ? detail.postCount : list.loading || list.error ? null : list.posts.length;
  const logo = tickerLogo(ticker);
  const up = (quote?.changePct ?? 0) > 0;
  const down = (quote?.changePct ?? 0) < 0;
  const tone = up ? "text-primary" : down ? "text-bear" : "text-muted-foreground";

  async function toggleWatch() {
    if (!token || watchPending) return;
    const next = !watching;
    setWatchingState(next);
    setWatchPending(true);
    try {
      const result = await setWatching(token, ticker, next);
      setWatchingState(result.watching);
    } catch {
      setWatchingState(!next);
    } finally {
      setWatchPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title={company ?? `$${ticker}`}
        subtitle={company ? `$${ticker}` : undefined}
        back
        action={
          <button
            type="button"
            onClick={() => void toggleWatch()}
            disabled={!token || watchPending}
            aria-pressed={watching}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold transition-transform active:scale-95 disabled:opacity-60",
              watching
                ? "border border-border text-foreground hover:border-bear hover:text-bear"
                : "bg-foreground text-background hover:opacity-90",
            )}
          >
            {watching ? "Following" : "Follow"}
          </button>
        }
      />

      <section className="border-b px-4 py-5" aria-label={`${ticker} quote`}>
        <link rel="preload" as="image" href={logo.webp} type="image/webp" />
        {quote ? (
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TickerLogo symbol={ticker} storedUrl={detail?.logoUrl} />
                <div className="min-w-0">
                  {rawSector ? (
                    <Link href={sectorPath(rawSector)} className="text-xs font-medium tracking-wide text-muted-foreground hover:underline">
                      {detail?.subSector ? `${sector} · ${detail.subSector}` : sector}
                    </Link>
                  ) : (
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">{sector}</p>
                  )}
                </div>
              </div>
              <p className="mt-2 font-mono text-4xl font-semibold tracking-tight">₦{formatNaira(quote.price)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-lg font-semibold">
                <PriceChange changePct={quote.changePct} />
              </p>
              {quote.changePct !== 0 && (
                <p className={cn("mt-0.5 font-mono text-sm", tone)}>{formatMove(moveNaira(quote.price, quote.changePct))}</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <TickerLogo symbol={ticker} storedUrl={detail?.logoUrl} />
              <p className="text-xs font-medium tracking-wide text-muted-foreground">{sector}</p>
            </div>
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

        {(company || detail?.about || detail?.natureOfBusiness) && (
          <div className="mt-4 max-w-xl space-y-1">
            {company && (
              <p className="text-sm text-muted-foreground">
                ${ticker} is the stock symbol for {company}.
              </p>
            )}
            {detail?.industry && <p className="text-sm leading-relaxed">{detail.industry}</p>}
            {detail?.about && <p className="text-sm leading-relaxed">{detail.about}</p>}
            {detail?.natureOfBusiness &&
              detail.natureOfBusiness.toLowerCase() !== detail.about?.toLowerCase() && (
                <p className="text-sm text-muted-foreground">{detail.natureOfBusiness}</p>
              )}
          </div>
        )}

        <CompanyFacts detail={detail} />

        {quote && <SessionStats quote={quote} />}

        <p className="mt-3 text-xs text-muted-foreground">
          {snapshot?.sessionDate ? `NGX close · ${formatSession(snapshot.sessionDate)}` : "NGX close"}
          {postCount != null && (
            <>
              <span className="mx-1.5">·</span>
              {postCount} {postCount === 1 ? "post" : "posts"}
            </>
          )}
        </p>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Sentiment</h2>
            <div className="flex rounded-full border p-0.5" role="group" aria-label="Sentiment window">
              {WINDOWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={windowId === item.id}
                  onClick={() => setWindowId(item.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    windowId === item.id ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {sentimentTotal > 0 ? (
            <>
              <p className="mb-2 font-mono text-xs text-muted-foreground">
                {sentiment.bulls} bull · {sentiment.bears} bear
              </p>
              <SentimentBar bull={pctBull} label={`$${ticker} ${windowId}`} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No bull or bear reads in this window yet.</p>
          )}
        </div>

        <PriceAlertRow symbol={ticker} />
      </section>

      <WeekStrip symbol={ticker} />

      <Composer
        key={ticker}
        persistDrafts
        onPost={(body, stance, extras) => publish(body, stance, null, extras)}
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

function tickerLogo(symbol: string) {
  return {
    webp: `https://cdn.jsdelivr.net/gh/ngnmarket/ngx-logos/dist/webp/${symbol}.webp`,
    png: `https://cdn.jsdelivr.net/gh/ngnmarket/ngx-logos/dist/png/${symbol}.png`,
  };
}

function TickerLogo({ symbol, storedUrl }: { symbol: string; storedUrl?: string | null }) {
  const { webp, png } = tickerLogo(symbol);
  const [stage, setStage] = useState<"webp" | "png" | "stored" | "none">("webp");

  useEffect(() => {
    setStage("webp");
  }, [symbol]);

  const src = stage === "webp" ? webp : stage === "png" ? png : stage === "stored" ? storedUrl : null;
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      width={32}
      height={32}
      className="size-8 shrink-0 rounded-md bg-card object-contain"
      onError={() =>
        setStage((current) => {
          if (current === "webp") return "png";
          if (current === "png" && storedUrl && storedUrl !== webp && storedUrl !== png) return "stored";
          return "none";
        })
      }
    />
  );
}

function CompanyFacts({ detail }: { detail: TickerDetail | null }) {
  if (!detail) return null;
  const facts = [
    detail.ceo ? ["CEO", detail.ceo] : null,
    detail.foundedYear ? ["Founded", String(detail.foundedYear)] : null,
    detail.employees ? ["Employees", detail.employees.toLocaleString("en-NG")] : null,
    detail.country ? ["Country", detail.country] : null,
    detail.fiscalYear ? ["Fiscal year", detail.fiscalYear] : null,
    detail.reportingCurrency ? ["Reporting currency", detail.reportingCurrency] : null,
    detail.sicCode ? ["SIC", detail.sicCode] : null,
    detail.phone ? ["Phone", detail.phone] : null,
    detail.address ? ["Address", detail.address] : null,
  ].filter((row): row is [string, string] => !!row);
  if (facts.length === 0 && !detail.executives && !detail.website) return null;
  return (
    <div className="mt-4 max-w-xl space-y-2 text-sm">
      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {detail.executives && <p className="text-muted-foreground">{detail.executives}</p>}
      {detail.website && (
        <a href={detail.website.startsWith("http") ? detail.website : `https://${detail.website}`} className="text-primary hover:underline">
          {detail.website.replace(/^https?:\/\//, "")}
        </a>
      )}
    </div>
  );
}

function SessionStats({
  quote,
}: {
  quote: { volume: number | null; value: number | null; high: number | null; low: number | null; trades: number | null };
}) {
  const cells = [
    quote.high != null ? { label: "High", value: `₦${formatNaira(quote.high)}` } : null,
    quote.low != null ? { label: "Low", value: `₦${formatNaira(quote.low)}` } : null,
    quote.volume != null ? { label: "Volume", value: formatCount(quote.volume) } : null,
    quote.value != null ? { label: "Value", value: formatTurnover(quote.value) } : null,
    quote.trades != null ? { label: "Trades", value: formatCount(quote.trades) } : null,
  ].filter((cell): cell is { label: string; value: string } => !!cell);
  if (cells.length === 0) return null;

  return (
    <dl className="mt-4 grid grid-cols-3 gap-3">
      {cells.map((cell) => (
        <div key={cell.label}>
          <dt className="text-[0.65rem] font-medium tracking-wide text-muted-foreground">{cell.label}</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PriceAlertRow({ symbol }: { symbol: string }) {
  const { token, ready } = useSquare();
  const [alert, setAlert] = useState<PriceAlert | null>(null);
  const [threshold, setThreshold] = useState("5");
  const [direction, setDirection] = useState<PriceAlert["direction"]>("either");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    fetchAlert(token, symbol)
      .then((next) => {
        if (cancelled) return;
        setAlert(next);
        if (next) {
          setThreshold(String(next.thresholdPct));
          setDirection(next.direction);
        }
      })
      .catch(() => {
        if (!cancelled) setAlert(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, ready, symbol]);

  async function save() {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await saveAlert(token, symbol, { thresholdPct: Number(threshold), direction });
      setAlert(next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the alert");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!token || saving) return;
    setSaving(true);
    try {
      await deleteAlert(token, symbol);
      setAlert(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the alert");
    } finally {
      setSaving(false);
    }
  }

  const directionLabel = direction === "up" ? "up" : direction === "down" ? "down" : "either way";

  return (
    <div className="mt-5 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Price alert</h2>
        {alert && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-primary">
            Edit
          </button>
        ) : null}
      </div>
      {alert && !editing ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Push when ${symbol} moves {alert.thresholdPct}% {alert.direction === "up" ? "up" : alert.direction === "down" ? "down" : "either way"} this session.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor={`alert-${symbol}`}>
            Move
          </label>
          <input
            id={`alert-${symbol}`}
            inputMode="decimal"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            className="h-9 w-16 rounded-full border bg-transparent px-3 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="text-sm text-muted-foreground">% {directionLabel}</span>
          <select
            aria-label="Alert direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value as PriceAlert["direction"])}
            className="h-9 rounded-full border bg-transparent px-2 text-sm"
          >
            <option value="either">Either way</option>
            <option value="up">Up only</option>
            <option value="down">Down only</option>
          </select>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="min-h-9 rounded-full bg-foreground px-3 text-sm font-bold text-background disabled:opacity-50"
          >
            {alert ? "Update" : "Alert me"}
          </button>
          {alert && (
            <button type="button" disabled={saving} onClick={() => void remove()} className="text-sm font-semibold text-bear">
              Remove
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-bear">{error}</p>}
    </div>
  );
}
