"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/site";
import { MobileMenuButton } from "@/components/square/mobile-menu";
import { Composer, EmptyState, PostFeed, TabBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchPosts, fetchWatchlist } from "@/components/square/api";
import type { Post } from "@/components/square/data";
import { useCurrentAuthor } from "@/components/square/use-current-author";
import { usePostList } from "@/components/square/use-post-list";
import { WeekStrip } from "@/components/square/week-strip";

type Tab = "for-you" | "following" | "watchlist" | "verified";
const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "following", label: "Following" },
  { id: "watchlist", label: "Watchlist" },
  { id: "verified", label: "Verified" },
];

const isTopLevel = (p: Post) => !p.parentId;
const isVerified = (p: Post) => !!p.author.verified;

export default function SquareIndex() {
  const { publish, following, token, ready } = useSquare();
  const me = useCurrentAuthor();
  const [tab, setTab] = useState<Tab>("for-you");
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    fetchWatchlist(token)
      .then((rows) => {
        if (!cancelled) setWatched(new Set(rows.map((row) => row.symbol)));
      })
      .catch(() => {
        if (!cancelled) setWatched(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [token, ready, tab]);

  const fetchPage = useCallback(
    (authToken: string, cursor: string | null) =>
      fetchPosts(authToken, {
        cursor,
        feed: tab === "following" ? "following" : tab === "watchlist" ? "watchlist" : undefined,
      }),
    [tab],
  );
  const includeRecent = useCallback(
    (post: Post) => {
      if (!isTopLevel(post)) return false;
      if (tab === "watchlist") return post.tickers.some((ticker) => watched.has(ticker));
      if (tab !== "following") return true;
      const authorId = post.author.id;
      return authorId === me.id || (!!authorId && following.has(authorId));
    },
    [tab, me.id, following, watched],
  );
  const list = usePostList({
    key: tab === "following" ? "home:following" : tab === "watchlist" ? "home:watchlist" : "home:all",
    fetchPage,
    includeRecent,
    keep: tab === "verified" ? isVerified : undefined,
  });

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/65 backdrop-blur-2xl backdrop-saturate-150">
        <div className="grid min-h-14 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center px-1.5 sm:hidden">
          <div className="flex justify-center">
            <MobileMenuButton />
          </div>
          <div className="flex items-center justify-center">
            <Logo mark className="size-8" />
          </div>
          <div aria-hidden="true" />
        </div>
        <h1 className="sr-only">The Square</h1>
        <div className="mt-1" data-tour="feed">
          <TabBar tabs={TABS} value={tab} onChange={setTab} label="Feed" />
        </div>
      </header>

      <Composer
        ref={composerRef}
        persistDrafts
        restoreDraft
        tourAnchor="composer"
        onPost={(body, stance, extras) => publish(body, stance, null, extras)}
      />
      <WeekStrip />

      <PostFeed
        list={list}
        empty={
          tab === "for-you" ? (
            <EmptyState title="Quiet on the floor" body="Be the first to share a thesis. Tag a ticker like $DANGCEM." />
          ) : tab === "following" ? (
            <EmptyState title="Quiet on the floor" body="Follow some voices to fill this tab." />
          ) : tab === "watchlist" ? (
            <EmptyState title="Your watchlist is quiet" body="Follow a name from its ticker room. Posts about those names land here." />
          ) : (
            <EmptyState title="No verified voices yet" body="Verified analysts and institutions will show up here." />
          )
        }
      />
    </>
  );
}
