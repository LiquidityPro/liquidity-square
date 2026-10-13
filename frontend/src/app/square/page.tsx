"use client";
import { useCallback, useRef, useState } from "react";
import { Logo } from "@/components/site";
import { Composer, EmptyState, PostFeed, TabBar } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchPosts } from "@/components/square/api";
import type { Post } from "@/components/square/data";
import { usePostList } from "@/components/square/use-post-list";

type Tab = "for-you" | "following" | "verified";
const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "following", label: "Following" },
  { id: "verified", label: "Verified" },
];

const isTopLevel = (p: Post) => !p.parentId;
const isVerified = (p: Post) => !!p.author.verified;

export default function SquareIndex() {
  const { publish } = useSquare();
  const [tab, setTab] = useState<Tab>("for-you");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const fetchPage = useCallback(
    (token: string, cursor: string | null) =>
      fetchPosts(token, { cursor, feed: tab === "following" ? "following" : undefined }),
    [tab],
  );
  const list = usePostList({
    key: tab === "following" ? "home:following" : "home:all",
    fetchPage,
    includeRecent: isTopLevel,
    keep: tab === "verified" ? isVerified : undefined,
  });

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
        </div>
        <div className="mt-1">
          <TabBar tabs={TABS} value={tab} onChange={setTab} label="Feed" />
        </div>
      </header>

      <Composer ref={composerRef} onPost={(body, stance) => publish(body, stance)} />

      <PostFeed
        list={list}
        empty={
          tab === "for-you" ? (
            <EmptyState title="Quiet on the floor" body="Be the first to share a thesis. Tag a ticker like $DANGCEM." />
          ) : tab === "following" ? (
            <EmptyState title="Quiet on the floor" body="Follow some voices to fill this tab." />
          ) : (
            <EmptyState title="No verified voices yet" body="Verified analysts and institutions will show up here." />
          )
        }
      />
    </>
  );
}
