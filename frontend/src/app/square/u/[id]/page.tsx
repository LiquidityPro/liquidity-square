"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LuBookmark as Bookmark, LuCalendarDays as CalendarDays } from "react-icons/lu";
import { Avatar, EmptyState, FollowButton, PageHeader, PostFeed, TabBar } from "@/components/square/parts";
import { Verified } from "@/components/square/avatar";
import { useSquare } from "@/components/square/context";
import { fetchPosts, fetchProfile } from "@/components/square/api";
import { compact, type Post, type Profile } from "@/components/square/data";
import { usePostList } from "@/components/square/use-post-list";
import { useCurrentAuthor } from "@/components/square/use-current-author";

type Tab = "posts" | "likes";
const TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "likes", label: "Likes" },
];

const isLiked = (p: Post) => !!p.likedByMe;

export default function ProfilePage() {
  const { id } = useParams() as { id: string };
  const me = useCurrentAuthor();
  const { token, ready, following } = useSquare();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [tab, setTab] = useState<Tab>("posts");
  const isMe = me.id === id;

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    setStatus("loading");
    setProfile(null);
    fetchProfile(token, id)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setStatus("ready");
      })
      .catch((err: Error) => !cancelled && setStatus(/not found/i.test(err.message) ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [id, token, ready]);

  const fetchPage = useCallback(
    (t: string, cursor: string | null) =>
      fetchPosts(t, tab === "posts" ? { author: id, cursor } : { likedBy: id, cursor }),
    [id, tab],
  );
  const isOwnTopLevel = useCallback((p: Post) => p.author.id === id && !p.parentId, [id]);
  const list = usePostList({
    key: `profile:${id}:${tab}`,
    fetchPage,
    includeRecent: tab === "posts" ? isOwnTopLevel : undefined,
    keep: tab === "likes" && isMe ? isLiked : undefined,
    enabled: status === "ready",
  });

  // The profile's counts are a snapshot; adjust them for follows made on this page.
  const followers = profile
    ? profile.followers + Number(following.has(profile.id)) - Number(profile.followedByMe)
    : 0;

  if (status === "missing" || status === "error") {
    return (
      <>
        <PageHeader title="Profile" back />
        <EmptyState
          title={status === "missing" ? "This account doesn't exist" : "Couldn't load this profile"}
          body={status === "missing" ? "Try searching for another trader." : "Check your connection and try again."}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={profile?.name ?? "Profile"}
        subtitle={profile ? `${compact(profile.posts)} posts` : undefined}
        back
      />

      <section className="border-b animate-in fade-in">
        <div
          aria-hidden="true"
          className="h-32 bg-[radial-gradient(circle_at_20%_120%,color-mix(in_oklch,var(--primary)_45%,transparent),transparent_60%),radial-gradient(circle_at_90%_-20%,color-mix(in_oklch,var(--bear)_35%,transparent),transparent_55%)] bg-card sm:h-44"
        />
        <div className="px-4 pb-4">
          <div className="flex items-start justify-between">
            <div className="-mt-12 rounded-full ring-4 ring-background sm:-mt-16">
              {profile ? (
                <Avatar author={profile} size="lg" />
              ) : (
                <div className="size-24 animate-pulse rounded-full bg-card sm:size-32" />
              )}
            </div>
            <div className="flex items-center gap-2 pt-3">
              {isMe ? (
                <>
                  <Link
                    href="/square/bookmarks"
                    aria-label="Bookmarks"
                    className="grid size-9 place-items-center rounded-full border transition-colors hover:bg-card sm:hidden"
                  >
                    <Bookmark className="size-4" />
                  </Link>
                  <button
                    type="button"
                    disabled
                    title="Editing profiles is coming soon"
                    className="flex min-h-9 items-center gap-2 rounded-full border px-4 text-sm font-bold opacity-70"
                  >
                    Edit profile
                    <span className="label-mono rounded border border-primary/40 px-1.5 !text-[0.6rem] text-primary">
                      Soon
                    </span>
                  </button>
                </>
              ) : (
                profile && <FollowButton author={profile} />
              )}
            </div>
          </div>

          {profile ? (
            <>
              <h2 className="mt-3 flex items-center gap-1.5 text-xl font-bold">
                {profile.name}
                {profile.verified && <Verified role={profile.role} />}
              </h2>
              <p className="font-mono text-sm text-muted-foreground">@{profile.handle}</p>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-4" aria-hidden="true" />
                Joined{" "}
                {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </p>
              <div className="mt-3 flex gap-5 text-sm">
                <span className="text-muted-foreground">
                  <span className="font-mono font-bold tabular-nums text-foreground">{compact(profile.following)}</span>{" "}
                  Following
                </span>
                <span className="text-muted-foreground">
                  <span className="font-mono font-bold tabular-nums text-foreground">{compact(followers)}</span>{" "}
                  {followers === 1 ? "Follower" : "Followers"}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-4 space-y-2" aria-hidden="true">
              <div className="h-5 w-40 animate-pulse rounded bg-card" />
              <div className="h-3 w-24 animate-pulse rounded bg-card" />
              <div className="h-3 w-52 animate-pulse rounded bg-card" />
            </div>
          )}
        </div>
        <TabBar tabs={TABS} value={tab} onChange={setTab} label="Profile sections" />
      </section>

      <PostFeed
        list={list}
        empty={
          tab === "posts" ? (
            <EmptyState
              title={isMe ? "You haven't posted yet" : `@${profile?.handle ?? "user"} hasn't posted yet`}
              body={isMe ? "Share your first market call from the home feed." : "When they do, their posts will show up here."}
            />
          ) : (
            <EmptyState
              title={isMe ? "You don't have any likes yet" : "No likes yet"}
              body={isMe ? "Tap the heart on any post to show some love. It'll show up here." : undefined}
            />
          )
        }
      />
    </>
  );
}
