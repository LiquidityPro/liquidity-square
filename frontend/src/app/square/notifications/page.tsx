"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LuBell as Bell,
  LuFileText as FileText,
  LuHeart as Heart,
  LuMessageCircle as MessageCircle,
  LuQuote as Quote,
  LuRepeat2 as Repeat2,
  LuUserPlus as UserPlus,
} from "react-icons/lu";
import { Avatar, EmptyState, PageHeader, PostSkeleton, TabBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchFilings, fetchNotifications, markFilingsSeen, relativeTime, type StoredFiling } from "@/components/square/api";
import { notificationLink, type NotificationType, type SquareNotification } from "@/components/square/data";
import { cn } from "@/lib/utils";

type Tab = "all" | "mentions" | "filings";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "filings", label: "Filings" },
];

const WINDOWS: { days: number; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 183, label: "6 months" },
];

const COPY: Record<NotificationType, string> = {
  like: "liked your post",
  follow: "followed you",
  reply: "replied to your post",
  repost: "reposted your post",
  quote: "quoted your post",
  alert: "price alert",
  disclosure: "filed on the NGX",
  filings: "new NGX filings are waiting",
};

export default function NotificationsPage() {
  const { token, ready, markAllRead, incomingNotifications } = useSquare();
  const [tab, setTab] = useState<Tab>("all");
  const [days, setDays] = useState(7);
  const [items, setItems] = useState<SquareNotification[]>([]);
  const [filings, setFilings] = useState<StoredFiling[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "filings" || requested === "mentions" || requested === "all") setTab(requested);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchNotifications(token)
      .then(({ notifications }) => {
        if (cancelled) return;
        setItems(notifications);
        setError(null);
        markAllRead();
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load notifications"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, ready, markAllRead]);

  const merged = useMemo(() => {
    const seen = new Set(items.map((item) => item.id));
    const fresh = incomingNotifications.filter((item) => !seen.has(item.id));
    return [...fresh, ...items];
  }, [items, incomingNotifications]);

  const visible = useMemo(() => {
    if (tab === "mentions") return merged.filter((n) => n.type === "reply" || n.type === "quote");
    return merged.filter((n) => n.type !== "disclosure");
  }, [merged, tab]);

  useEffect(() => {
    if (tab !== "filings" || !ready || !token) return;
    let cancelled = false;
    setFilings(null);
    markFilingsSeen(token).catch((err) => console.error("Failed to mark filings seen", err));
    fetchFilings(token, days)
      .then((rows) => {
        if (!cancelled) setFilings(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setFilings([]);
        setError(err instanceof Error ? err.message : "Failed to load filings");
      });
    return () => {
      cancelled = true;
    };
  }, [tab, token, ready, days]);

  return (
    <>
      <PageHeader title="Notifications">
        <TabBar tabs={TABS} value={tab} onChange={setTab} label="Notifications" />
      </PageHeader>

      {error && (
        <p role="alert" className="border-b border-bear/30 bg-bear/10 px-4 py-2 text-sm text-bear">
          {error}
        </p>
      )}

      {tab === "filings" ? (
        <FilingsPanel days={days} onDays={setDays} filings={filings} />
      ) : loading ? (
        <PostSkeleton count={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === "mentions" ? "No mentions yet" : "You're caught up"}
          body={
            tab === "mentions"
              ? "When someone replies to you, it'll land here."
              : "Likes, follows, and replies show up here. NGX filings have their own tab."
          }
        />
      ) : (
        <ul>
          {visible.map((n) => (
            <NotificationRow key={n.id} item={n} />
          ))}
        </ul>
      )}
    </>
  );
}

function FilingsPanel({
  days,
  onDays,
  filings,
}: {
  days: number;
  onDays: (days: number) => void;
  filings: StoredFiling[] | null;
}) {
  return (
    <section aria-label="NGX filings">
      <div className="flex gap-2 border-b px-4 py-3" role="group" aria-label="Filing window">
        {WINDOWS.map((window) => (
          <button
            key={window.days}
            type="button"
            aria-pressed={days === window.days}
            onClick={() => onDays(window.days)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-sm font-semibold",
              days === window.days ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
            )}
          >
            {window.label}
          </button>
        ))}
      </div>
      {filings === null ? (
        <PostSkeleton count={4} />
      ) : filings.length === 0 ? (
        <EmptyState title="No filings in this window" body="Corporate filings from the NGX show up here." />
      ) : (
        <ul>
          {filings.map((filing) => (
            <li key={filing.id} className="border-b px-4 py-3">
              <p className="label-mono !text-[0.62rem] text-muted-foreground">
                {filing.label} · {relativeTime(filing.filedAt)}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold">
                <Link href={`/square/${filing.symbol}`} className="hover:underline">
                  ${filing.symbol}
                </Link>
              </p>
              <a href={filing.url} target="_blank" rel="noreferrer" className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground hover:underline">
                {filing.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationRow({ item }: { item: SquareNotification }) {
  const link = notificationLink(item);
  const className = cn(
    "flex gap-3 border-b px-4 py-3 transition-colors hover:bg-card/60",
    !item.read && "bg-primary/5",
  );
  const body = (
    <>
      <NotificationIcon type={item.type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Avatar author={item.actor} size="sm" />
          <p className="min-w-0 text-sm">
            <span className="font-semibold">{item.actor.name}</span>{" "}
            <span className="text-muted-foreground">
              {(item.type === "alert" || item.type === "disclosure" || item.type === "filings") && item.summary
                ? item.summary
                : COPY[item.type]}
            </span>{" "}
            <span className="font-mono text-xs text-muted-foreground">· {item.time}</span>
          </p>
        </div>
        {item.post && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.post.body}</p>}
      </div>
    </>
  );
  return (
    <li>
      {link.external ? (
        <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
          {body}
        </a>
      ) : (
        <Link href={link.href} className={className}>
          {body}
        </Link>
      )}
    </li>
  );
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const className = cn(
    "mt-1 size-5 shrink-0",
    type === "like" ? "text-bear" : "text-primary",
    type === "like" && "fill-current",
  );
  switch (type) {
    case "like":
      return <Heart className={className} aria-hidden="true" />;
    case "repost":
      return <Repeat2 className={className} aria-hidden="true" />;
    case "follow":
      return <UserPlus className={className} aria-hidden="true" />;
    case "reply":
      return <MessageCircle className={className} aria-hidden="true" />;
    case "quote":
      return <Quote className={className} aria-hidden="true" />;
    case "alert":
      return <Bell className={className} aria-hidden="true" />;
    case "disclosure":
    case "filings":
      return <FileText className={className} aria-hidden="true" />;
  }
}
