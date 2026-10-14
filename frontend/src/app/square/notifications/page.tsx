"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LuHeart as Heart,
  LuMessageCircle as MessageCircle,
  LuRepeat2 as Repeat2,
  LuUserPlus as UserPlus,
} from "react-icons/lu";
import { Avatar, EmptyState, PageHeader, PostSkeleton, TabBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchNotifications } from "@/components/square/api";
import { type NotificationType, type SquareNotification } from "@/components/square/data";
import { postPath, profilePath } from "@/components/square/post-card";
import { cn } from "@/lib/utils";

type Tab = "all" | "mentions";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
];

const COPY: Record<NotificationType, string> = {
  like: "liked your post",
  follow: "followed you",
  reply: "replied to your post",
  repost: "reposted your post",
};

export default function NotificationsPage() {
  const { token, ready, markAllRead, incomingNotifications } = useSquare();
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<SquareNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
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

  const visible = useMemo(
    () => (tab === "mentions" ? merged.filter((n) => n.type === "reply") : merged),
    [merged, tab],
  );

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

      {loading ? (
        <PostSkeleton count={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === "mentions" ? "No mentions yet" : "You're caught up"}
          body={
            tab === "mentions"
              ? "When someone replies to you, it'll land here."
              : "Likes, follows, replies and reposts will show up here."
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

function NotificationRow({ item }: { item: SquareNotification }) {
  const href = item.post ? postPath(item.post.id) : profilePath(item.actor) ?? "/square";
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex gap-3 border-b px-4 py-3 transition-colors hover:bg-card/60",
          !item.read && "bg-primary/5",
        )}
      >
        <NotificationIcon type={item.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Avatar author={item.actor} size="sm" />
            <p className="min-w-0 text-sm">
              <span className="font-semibold">{item.actor.name}</span>{" "}
              <span className="text-muted-foreground">{COPY[item.type]}</span>{" "}
              <span className="font-mono text-xs text-muted-foreground">· {item.time}</span>
            </p>
          </div>
          {item.post && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.post.body}</p>
          )}
        </div>
      </Link>
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
  }
}
