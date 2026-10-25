"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LuArrowLeft as ArrowLeft } from "react-icons/lu";
import { cn } from "@/lib/utils";
import { MobileMenuButton } from "./mobile-menu";
import { PostCard } from "./post-card";
import type { Author } from "./data";
import type { PostList } from "./use-post-list";

/* Sticky glass header                                                 */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  back,
  action,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Show a back button; falls back to The Square when there's no history. */
  back?: boolean;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b bg-background/65 backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex min-h-14 items-center gap-2 px-1.5 py-2 sm:gap-3 sm:px-4">
        <div className="sm:hidden">
          <MobileMenuButton />
        </div>
        {back && (
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/square"))}
            className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-card"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{title}</h1>
          {subtitle && <p className="truncate font-mono text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}

/* Tabs with the primary underline                                     */
/* ------------------------------------------------------------------ */

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative min-h-12 flex-1 text-sm transition-colors hover:bg-card",
            value === t.id ? "font-bold text-foreground" : "font-medium text-muted-foreground",
          )}
        >
          {t.label}
          {value === t.id && (
            <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}

/* Empty / loading states                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({ title, body, children }: { title: string; body?: ReactNode; children?: ReactNode }) {
  return (
    <div className="px-8 py-16 text-center animate-in fade-in">
      <p className="font-display text-2xl font-bold">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-muted-foreground">{body}</p>}
      {children}
    </div>
  );
}

export function PostSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-label="Loading posts" role="status">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3 border-b px-4 py-4">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-card" />
          <div className="flex-1 space-y-2.5 pt-1">
            <div className="h-3 w-1/3 animate-pulse rounded bg-card" />
            <div className="h-3 w-full animate-pulse rounded bg-card" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-card" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="border-b border-bear/30 bg-bear/10 px-4 py-2 text-sm text-bear">
      {message}
    </p>
  );
}

/* Feed with infinite scroll                                           */
/* ------------------------------------------------------------------ */

export function PostFeed({
  list,
  empty,
  endLabel = "You're all caught up",
  repostedBy,
}: {
  list: PostList;
  empty: ReactNode;
  endLabel?: string;
  repostedBy?: Author;
}) {
  const { posts, loading, loadingMore, error, hasMore, loadMore } = list;
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      rootMargin: "600px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (loading && posts.length === 0) return <PostSkeleton />;

  return (
    <>
      {error && <InlineError message={error} />}
      {posts.length > 0 ? posts.map((p) => <PostCard key={p.id} post={p} repostedBy={repostedBy} />) : !error && empty}
      {hasMore && <div ref={sentinel} aria-hidden="true" />}
      {loadingMore && <PostSkeleton count={1} />}
      {posts.length > 0 && !hasMore && (
        <p className="label-mono py-10 text-center text-muted-foreground">{endLabel}</p>
      )}
    </>
  );
}
