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
  const { token, ready, postsById, recentIds, cachePosts } = useSquare();
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
    const recent = includeRecent ? recentIds.filter((id) => postsById[id] && includeRecent(postsById[id])) : [];
    const ordered = recentAt === "top" ? [...recent, ...ids] : [...ids, ...recent.reverse()];
    const seen = new Set<string>();
    return ordered.flatMap((id) => {
      const post = postsById[id];
      if (!post || seen.has(id) || (keep && !keep(post))) return [];
      seen.add(id);
      return [post];
    });
  }, [ids, recentIds, postsById, includeRecent, recentAt, keep]);

  return { posts, loading: loading || !ready, loadingMore, error, hasMore: !!cursor, loadMore };
}
