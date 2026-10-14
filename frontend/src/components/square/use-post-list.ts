"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "./data";
import type { PostPage } from "./api";
import { useSquare } from "./context";

type Options = {
  /** Identifies the list; changing it refetches from the first page. */
  key: string;
  fetchPage: (token: string, cursor: string | null) => Promise<PostPage>;
  /** Which posts published this session belong in the list. */
  includeRecent?: (post: Post) => boolean;
  /** Where recently published posts go: newest-first feeds use "top", oldest-first threads use "bottom". */
  recentAt?: "top" | "bottom";
  /** Drop cached posts that no longer belong, e.g. un-bookmarked posts on the bookmarks page. */
  keep?: (post: Post) => boolean;
  enabled?: boolean;
};

export type PostList = {
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
};

export function usePostList({
  key,
  fetchPage,
  includeRecent,
  recentAt = "top",
  keep,
  enabled = true,
}: Options): PostList {
  const { token, ready, postsById, recentIds, incomingIds, cachePosts } = useSquare();
  const [ids, setIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  }, [fetchPage]);

  useEffect(() => {
    if (!ready || !enabled) return;
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setIds([]);
    setCursor(null);
    fetchRef.current(token, null)
      .then((page) => {
        if (cancelled) return;
        cachePosts(page.posts);
        setIds(page.posts.map((p) => p.id));
        setCursor(page.nextCursor);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load posts"))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [key, token, ready, enabled, cachePosts]);

  const loadMore = useCallback(() => {
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    fetchRef.current(token, cursor)
      .then((page) => {
        cachePosts(page.posts);
        setIds((prev) => [...prev, ...page.posts.map((p) => p.id)]);
        setCursor(page.nextCursor);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load more posts"))
      .finally(() => setLoadingMore(false));
  }, [token, cursor, loadingMore, cachePosts]);

  const posts = useMemo(() => {
    const loaded = new Set(ids);
    // Oldest-first threads only splice in live replies once every page is loaded,
    // so a new reply doesn't land in the middle of an unfinished thread.
    const pool = recentAt === "bottom" && cursor ? recentIds : [...incomingIds, ...recentIds];
    const extraIds: string[] = [];
    const seenExtra = new Set<string>();
    for (const id of pool) {
      if (seenExtra.has(id) || loaded.has(id)) continue;
      seenExtra.add(id);
      extraIds.push(id);
    }

    const loadedPosts = ids.flatMap((id) => (postsById[id] ? [postsById[id]] : []));
    const newestLoadedAt = recentAt === "top" ? loadedPosts[0]?.createdAt : undefined;
    const ownIds = new Set(recentIds);

    const extras = extraIds
      .flatMap((id) => {
        const post = postsById[id];
        if (!post || !includeRecent?.(post)) return [];
        // Keep the feed in order: a live post older than the current head belongs further down the page.
        if (
          recentAt === "top" &&
          newestLoadedAt &&
          post.createdAt &&
          post.createdAt < newestLoadedAt &&
          !ownIds.has(post.id)
        ) {
          return [];
        }
        return [post];
      })
      .sort((a, b) => {
        const delta = (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
        return recentAt === "top" ? -delta : delta;
      });

    const ordered = recentAt === "top" ? [...extras, ...loadedPosts] : [...loadedPosts, ...extras];
    const seen = new Set<string>();
    return ordered.flatMap((post) => {
      if (seen.has(post.id) || (keep && !keep(post))) return [];
      seen.add(post.id);
      return [post];
    });
  }, [ids, cursor, recentIds, incomingIds, postsById, includeRecent, recentAt, keep]);

  return { posts, loading: loading || !ready, loadingMore, error, hasMore: !!cursor, loadMore };
}
