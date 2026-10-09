"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site";
import { Composer, PostCard } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";

type Tab = "for-you" | "following" | "verified";
const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "following", label: "Following" },
  { id: "verified", label: "Verified" },
];

export default function SquareIndex() {
  const { posts, following, handlePost } = useSquare();
  const [tab, setTab] = useState<Tab>("for-you");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const feed = useMemo(
    () =>
      posts.filter((p) => {
        if (tab === "following") return following.has(p.author.handle);
        if (tab === "verified") return !!p.author.verified;
        return true;
      }),
    [posts, tab, following]
  );

  function handleTickerNav(ticker: string) {
    router.push(`/square/${ticker}`);
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/65 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-3">
            <div className="sm:hidden [&_span]:hidden">
              <Logo />
            </div>
            <h1 className="text-xl font-bold">The Square</h1>
          </div>
          <span className="label-mono flex items-center gap-1.5 text-primary">
            <span className="size-1.5 animate-blink rounded-full bg-primary" /> Preview
          </span>
        </div>
        <div role="tablist" aria-label="Feed" className="mt-1 flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative min-h-12 flex-1 text-sm transition-colors hover:bg-card",
                tab === t.id ? "font-bold text-foreground" : "font-medium text-muted-foreground"
              )}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </header>

      <Composer ref={composerRef} onPost={handlePost} />

      {feed.length > 0 ? (
        feed.map((p) => <PostCard key={p.id} post={p} onTicker={handleTickerNav} />)
      ) : (
        <div className="px-8 py-16 text-center">
          <p className="font-display text-2xl font-bold">Quiet on the floor</p>
          <p className="mt-2 text-muted-foreground">Follow some voices to fill this tab.</p>
        </div>
      )}

      {feed.length > 0 && (
        <p className="label-mono py-10 text-center text-muted-foreground">You're all caught up · placeholder feed</p>
      )}
    </>
  );
}
