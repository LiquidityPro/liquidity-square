"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LuBookmark as Bookmark,
  LuCalendarDays as CalendarDays,
  LuEllipsisVertical as EllipsisVertical,
  LuLink as LinkIcon,
  LuMail as Mail,
  LuMapPin as MapPin,
} from "react-icons/lu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, EmptyState, FollowButton, PageHeader, PostFeed, TabBar } from "@/components/square/parts";
import { Verified } from "@/components/square/avatar";
import { authorBadge } from "@/components/square/data";
import { useSquare } from "@/components/square/context";
import { fetchPosts, fetchProfile, setBlocked, setMuted } from "@/components/square/api";
import { ReportDialog } from "@/components/square/safety";
import { toast } from "sonner";
import { compact, type Post, type Profile } from "@/components/square/data";
import { EditProfileDialog } from "@/components/square/edit-profile";
import { bannerClass, websiteHref, websiteLabel } from "@/components/square/profile-meta";
import { usePostList } from "@/components/square/use-post-list";
import { useCurrentAuthor } from "@/components/square/use-current-author";

type Tab = "posts" | "replies" | "reposts" | "media" | "likes";
const TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "replies", label: "Replies" },
  { id: "reposts", label: "Reposts" },
  { id: "media", label: "Media" },
  { id: "likes", label: "Likes" },
];

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${compact(count)} ${count === 1 ? singular : plural}`;
}

const isLiked = (p: Post) => !!p.likedByMe;

export default function ProfilePage() {
  const { id } = useParams() as { id: string };
  const me = useCurrentAuthor();
  const { update } = useSession();
  const { token, ready, following } = useSquare();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [tab, setTab] = useState<Tab>("posts");
  const [editing, setEditing] = useState(false);
  const openedEdit = useRef<string | null>(null);
  const syncedHandle = useRef<string | null>(null);
  const userId = profile?.id ?? id;
  const isMe = me.id === userId;

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    setStatus("loading");
    setProfile(null);
    fetchProfile(token, id)
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setStatus("ready");
      })
      .catch((err: Error) => !cancelled && setStatus(/not found/i.test(err.message) ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [id, token, ready]);

  useEffect(() => {
    if (!isMe || !profile?.handle || me.handle === profile.handle || syncedHandle.current === profile.handle) return;
    syncedHandle.current = profile.handle;
    void update({ username: profile.handle });
  }, [isMe, profile?.handle, me.handle, update]);

  useEffect(() => {
    if (!isMe || !profile || openedEdit.current === id) return;
    if (new URLSearchParams(window.location.search).get("edit") === "1") {
      openedEdit.current = id;
      setEditing(true);
    }
  }, [isMe, profile, id]);

  const fetchPage = useCallback(
    (t: string, cursor: string | null) => {
      if (tab === "replies") return fetchPosts(t, { author: userId, replies: true, cursor });
      if (tab === "reposts") return fetchPosts(t, { repostedBy: userId, cursor });
      if (tab === "likes") return fetchPosts(t, { likedBy: userId, cursor });
      return fetchPosts(t, { author: userId, cursor });
    },
    [userId, tab],
  );
  const isOwnTopLevel = useCallback((p: Post) => p.author.id === userId && !p.parentId, [userId]);
  const isOwnReply = useCallback((p: Post) => p.author.id === userId && !!p.parentId, [userId]);
  const list = usePostList({
    key: `profile:${userId}:${tab}`,
    fetchPage,
    includeRecent: tab === "posts" ? isOwnTopLevel : tab === "replies" ? isOwnReply : undefined,
    keep: tab === "likes" && isMe ? isLiked : undefined,
    enabled: status === "ready" && tab !== "media",
  });

  const followers = profile
    ? profile.followers + Number(following.has(profile.id)) - Number(profile.followedByMe)
    : 0;
  const serverCounts = {
    posts: profile?.posts ?? 0,
    replies: profile?.replies ?? 0,
    reposts: profile?.reposts ?? 0,
    likes: profile?.likes ?? 0,
  };
  const loadedCount = !list.loading && !list.hasMore && tab !== "media" ? list.posts.length : null;
  const counts = loadedCount == null ? serverCounts : { ...serverCounts, [tab]: loadedCount };
  const tabs = TABS.map((item) => {
    if (item.id === "media" || !profile) return item;
    return { ...item, label: `${item.label} ${compact(counts[item.id])}` };
  });

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
        subtitle={profile ? countLabel(counts.posts, "post") : undefined}
        back
      />

      <section className="border-b animate-in fade-in">
        <div aria-hidden="true" className={`h-32 sm:h-44 ${profile ? bannerClass(profile.banner) : "bg-card"}`} />
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
                    onClick={() => setEditing(true)}
                    disabled={!profile}
                    className="min-h-9 rounded-full border px-4 text-sm font-bold transition hover:bg-card disabled:opacity-60"
                  >
                    Edit profile
                  </button>
                </>
              ) : (
                profile && (
                  <>
                    {!profile.blockedMe && !profile.blockedByMe && (
                      <>
                        <Link
                          href={`/square/messages/new/${profile.id}`}
                          aria-label={`Message @${profile.handle}`}
                          className="grid size-9 place-items-center rounded-full border transition-colors hover:bg-card"
                        >
                          <Mail className="size-4" />
                        </Link>
                        <FollowButton author={profile} />
                      </>
                    )}
                    <ProfileMenu profile={profile} onChange={setProfile} />
                  </>
                )
              )}
            </div>
          </div>

          {profile ? (
            <>
              <h2 className="mt-3 flex items-center gap-1.5 text-xl font-bold">
                {profile.name}
                {authorBadge(profile) && <Verified badge={authorBadge(profile)!} role={profile.role} />}
              </h2>
              <p className="font-mono text-sm text-muted-foreground">@{profile.handle}</p>
              {profile.title ? (
                <p className="mt-1 text-sm text-muted-foreground">{profile.title}</p>
              ) : (
                isMe && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-1 text-[15px] text-muted-foreground hover:underline"
                  >
                    Add a title
                  </button>
                )
              )}
              {profile.bio ? (
                <p className="mt-3 whitespace-pre-wrap text-[15px]">{profile.bio}</p>
              ) : (
                isMe && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-3 text-[15px] text-muted-foreground hover:underline"
                  >
                    Add a bio
                  </button>
                )
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {profile.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" aria-hidden="true" />
                    {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a
                    href={websiteHref(profile.website)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <LinkIcon className="size-4" aria-hidden="true" />
                    {websiteLabel(profile.website)}
                  </a>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  Joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
              </div>
              <div className="mt-3 flex gap-5 text-sm">
                <Link href={`/square/u/${profile.id}/following`} className="text-muted-foreground hover:underline">
                  <span className="font-mono font-bold tabular-nums text-foreground">{compact(profile.following)}</span>{" "}
                  Following
                </Link>
                <Link href={`/square/u/${profile.id}/followers`} className="text-muted-foreground hover:underline">
                  <span className="font-mono font-bold tabular-nums text-foreground">{compact(followers)}</span>{" "}
                  {followers === 1 ? "Follower" : "Followers"}
                </Link>
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
        <TabBar tabs={tabs} value={tab} onChange={setTab} label="Profile sections" />
      </section>

      {profile && (profile.blockedMe || profile.blockedByMe) ? (
        <EmptyState
          title={profile.blockedByMe ? "You blocked this account" : "You can't see this account"}
          body={profile.blockedByMe ? "Unblock them to see their posts again." : "They've blocked you."}
        />
      ) : tab === "media" ? (
        <EmptyState
          title={isMe ? "You haven't posted media" : "No photos or videos"}
          body={isMe ? "Photos and videos you share will show up in this tab." : "When they post photos or videos, they'll show up here."}
        />
      ) : (
        <PostFeed
          list={list}
          repostedBy={tab === "reposts" ? profile ?? undefined : undefined}
          empty={
            tab === "posts" ? (
              <EmptyState
                title={isMe ? "You haven't posted yet" : `@${profile?.handle ?? "user"} hasn't posted yet`}
                body={isMe ? "Share your first market call from the home feed." : "When they do, their posts will show up here."}
              />
            ) : tab === "replies" ? (
              <EmptyState
                title={isMe ? "You haven't replied yet" : "No replies yet"}
                body={isMe ? "Replies you leave on the floor will show up in this tab." : undefined}
              />
            ) : tab === "reposts" ? (
              <EmptyState
                title={isMe ? "You haven't reposted yet" : "No reposts yet"}
                body={isMe ? "Reposts you share from the floor will show up in this tab." : undefined}
              />
            ) : (
              <EmptyState
                title={isMe ? "You don't have any likes yet" : "No likes yet"}
                body={isMe ? "Tap the heart on any post to show some love. It'll show up here." : undefined}
              />
            )
          }
        />
      )}

      {profile && isMe && (
        <EditProfileDialog profile={profile} open={editing} onOpenChange={setEditing} onSaved={setProfile} />
      )}
    </>
  );
}

function ProfileMenu({ profile, onChange }: { profile: Profile; onChange: (profile: Profile) => void }) {
  const { token, hideAuthor } = useSquare();
  const [reporting, setReporting] = useState(false);
  const [pending, setPending] = useState(false);

  async function run(action: "mute" | "block") {
    if (!token || pending) return;
    setPending(true);
    const on = action === "mute" ? !profile.mutedByMe : !profile.blockedByMe;
    try {
      if (action === "mute") await setMuted(token, profile.id, on);
      else await setBlocked(token, profile.id, on);
      onChange({
        ...profile,
        mutedByMe: action === "mute" ? on : profile.mutedByMe,
        blockedByMe: action === "block" ? on : false,
        followedByMe: action === "block" && on ? false : profile.followedByMe,
      });
      if (on) hideAuthor(profile.id);
      toast.success(
        action === "mute"
          ? on
            ? `Muted @${profile.handle}`
            : `Unmuted @${profile.handle}`
          : on
            ? `Blocked @${profile.handle}`
            : `Unblocked @${profile.handle}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update this account");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account options"
            className="grid size-9 place-items-center rounded-full border text-muted-foreground transition-colors hover:bg-card hover:text-foreground data-[state=open]:bg-card"
          >
            <EllipsisVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44 rounded-xl border bg-background p-1 shadow-[0_8px_30px_-12px_var(--primary)]">
          {!profile.blockedMe && !profile.blockedByMe && (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => void run("mute")}
              className="cursor-pointer rounded-lg py-2 font-semibold"
            >
              {profile.mutedByMe ? "Unmute" : "Mute"}
            </DropdownMenuItem>
          )}
          {!profile.blockedMe && (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => void run("block")}
              className="cursor-pointer rounded-lg py-2 font-semibold text-bear focus:bg-bear/10 focus:text-bear"
            >
              {profile.blockedByMe ? "Unblock" : "Block"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setReporting(true)} className="cursor-pointer rounded-lg py-2 font-semibold">
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog open={reporting} onOpenChange={setReporting} userId={profile.id} />
    </>
  );
}
