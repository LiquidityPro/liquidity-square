"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOutSession } from "@/lib/session";
import { toast } from "sonner";
import { type Author, type NotificationType, type Post, type SquareNotification, extractTickers, type Stance } from "./data";
import {
  createPost,
  deletePost as deletePostRequest,
  fetchFollowing,
  markNotificationsRead,
  setFollowing,
  setReaction,
  type LiveUpdate,
  type Reaction,
} from "./api";
import { useLiveTracker } from "./use-live-tracker";
import { useCurrentAuthor } from "./use-current-author";
import { claimToast } from "@/components/pwa/push";

type SquareContextType = {
  token: string | undefined;
  /** False until the session has resolved. */
  ready: boolean;
  error: string | null;
  postsById: Record<string, Post>;
  /** Posts published in this session, newest first, so lists can show them before a refetch. */
  recentIds: string[];
  /** Posts that arrived from other people while this session was open. */
  incomingIds: string[];
  /** Notifications that arrived while this session was open, newest first. */
  incomingNotifications: SquareNotification[];
  cachePosts: (posts: Post[]) => void;
  publish: (body: string, stance: Stance, parentId?: string | null) => Promise<void>;
  deletePost: (postId: string) => Promise<boolean>;
  toggleLike: (postId: string) => void;
  toggleRepost: (postId: string) => void;
  toggleBookmark: (postId: string) => void;
  /** IDs of users the current user follows. */
  following: Set<string>;
  toggleFollow: (author: Author) => void;
  unreadCount: number;
  markAllRead: () => void;
};

const SquareContext = createContext<SquareContextType | null>(null);

const PENDING_PREFIX = "pending-";
const INCOMING_POST_CAP = 300;
const INCOMING_NOTIFICATION_CAP = 50;

const NOTIFICATION_COPY: Record<NotificationType, string> = {
  like: "liked your post",
  follow: "followed you",
  reply: "replied to your post",
  repost: "reposted your post",
};

export const isPendingPost = (id: string) => id.startsWith(PENDING_PREFIX);

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function without<T>(record: Record<string, T>, keys: string[]): Record<string, T> {
  const next = { ...record };
  for (const key of keys) delete next[key];
  return next;
}

const REACTION_FIELDS = {
  like: { flag: "likedByMe", count: "likes" },
  repost: { flag: "repostedByMe", count: "reposts" },
  bookmark: { flag: "bookmarkedByMe", count: null },
} as const satisfies Record<Reaction, { flag: keyof Post; count: keyof Post | null }>;

export function SquareProvider({ children }: { children: ReactNode }) {
  const me = useCurrentAuthor();
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const ready = status !== "loading";

  const [postsById, setPostsById] = useState<Record<string, Post>>({});
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [incomingIds, setIncomingIds] = useState<string[]>([]);
  const [incomingNotifications, setIncomingNotifications] = useState<SquareNotification[]>([]);
  const [following, setFollowingIds] = useState<Set<string>>(() => new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const readEpoch = useRef(0);

  const postsRef = useRef(postsById);
  useEffect(() => {
    postsRef.current = postsById;
  }, [postsById]);

  const error = ready && !token ? "Your session has no API token. Sign out and sign in again." : null;

  useEffect(() => {
    if (status === "authenticated" && !token) {
      void signOutSession();
    }
  }, [status, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchFollowing(token)
      .then((users) => !cancelled && setFollowingIds(new Set(users.flatMap((u) => (u.id ? [u.id] : [])))))
      .catch((err) => console.error("Failed to load following", err));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (token) return;
    setUnreadCount(0);
    setIncomingIds([]);
    setIncomingNotifications([]);
  }, [token]);

  const cachePosts = useCallback((posts: Post[]) => {
    if (posts.length === 0) return;
    setPostsById((prev) => {
      const next = { ...prev };
      for (const post of posts) {
        const existing = next[post.id];
        // Keep a locally bumped reply count when a slower page load returns a stale post.
        next[post.id] = existing ? { ...post, replies: Math.max(existing.replies, post.replies) } : post;
      }
      return next;
    });
  }, []);

  const addIncomingPosts = useCallback((posts: Post[]) => {
    const myId = me.id;
    // The composer already shows your own post. Ignore the live echo of that same publish.
    const isOwnPending = (post: Post) =>
      post.author.id === myId &&
      Object.values(postsRef.current).some(
        (existing) =>
          isPendingPost(existing.id) &&
          existing.body === post.body &&
          (existing.parentId ?? null) === (post.parentId ?? null),
      );

    setPostsById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const post of posts) {
        if (next[post.id] || isOwnPending(post)) continue;
        changed = true;
        next[post.id] = post;
        const parent = post.parentId ? next[post.parentId] : undefined;
        if (parent && post.author.id !== myId) {
          next[post.parentId!] = { ...parent, replies: parent.replies + 1 };
        }
      }
      return changed ? next : prev;
    });
    setIncomingIds((prev) => {
      const known = new Set(prev);
      const fresh = posts.flatMap((post) => {
        if (known.has(post.id) || postsRef.current[post.id] || isOwnPending(post)) return [];
        known.add(post.id);
        return [post.id];
      });
      if (fresh.length === 0) return prev;
      return [...fresh, ...prev].slice(0, INCOMING_POST_CAP);
    });
  }, [me.id]);

  const addIncomingNotifications = useCallback((items: SquareNotification[]) => {
    setIncomingNotifications((prev) => {
      const seen = new Set(prev.map((item) => item.id));
      const fresh = items.filter((item) => !seen.has(item.id));
      if (fresh.length === 0) return prev;
      return [...fresh, ...prev].slice(0, INCOMING_NOTIFICATION_CAP);
    });
  }, []);

  const livePrimed = useRef(false);

  const applyLive = useCallback(
    (update: LiveUpdate, epochAtStart: number) => {
      const baseline = !livePrimed.current;
      livePrimed.current = true;
      startTransition(() => {
        if (update.posts.length > 0) addIncomingPosts(update.posts);
        if (update.notifications.length > 0) addIncomingNotifications(update.notifications);
        if (epochAtStart === readEpoch.current) setUnreadCount(update.unreadCount);
      });
      for (const item of update.notifications) {
        if (baseline) {
          claimToast(item.id);
          continue;
        }
        if (document.visibilityState !== "visible" || !claimToast(item.id)) continue;
        const href = item.post ? `/square/post/${item.post.id}` : item.actor.id ? `/square/u/${item.actor.id}` : "/square/notifications";
        toast(`${item.actor.name} ${NOTIFICATION_COPY[item.type]}`, {
          description: item.post?.body,
          duration: 8000,
          action: { label: "View", onClick: () => router.push(href) },
        });
      }
    },
    [addIncomingPosts, addIncomingNotifications, router],
  );

  useLiveTracker(token, {
    currentEpoch: () => readEpoch.current,
    onUpdate: applyLive,
  });

  const patchPost = useCallback((postId: string, patch: Partial<Post>) => {
    setPostsById((prev) => (prev[postId] ? { ...prev, [postId]: { ...prev[postId], ...patch } } : prev));
  }, []);

  const bumpReplies = useCallback((parentId: string | null | undefined, delta: number) => {
    if (!parentId) return;
    setPostsById((prev) =>
      prev[parentId]
        ? { ...prev, [parentId]: { ...prev[parentId], replies: Math.max(0, prev[parentId].replies + delta) } }
        : prev,
    );
  }, []);

  const publish = useCallback(
    async (body: string, stance: Stance, parentId: string | null = null) => {
      if (!token) return;
      const pendingId = `${PENDING_PREFIX}${Date.now()}`;
      const pending: Post = {
        id: pendingId,
        author: me,
        time: "now",
        createdAt: new Date().toISOString(),
        body,
        stance,
        tickers: extractTickers(body),
        replies: 0,
        reposts: 0,
        likes: 0,
        parentId,
        replyTo: parentId ? (postsRef.current[parentId]?.author ?? null) : null,
      };

      setPostsById((prev) => ({ ...prev, [pendingId]: pending }));
      setRecentIds((prev) => [pendingId, ...prev]);
      bumpReplies(parentId, 1);

      try {
        const created = await createPost(token, body, stance, parentId);
        setPostsById((prev) => ({ ...without(prev, [pendingId]), [created.id]: created }));
        setRecentIds((prev) => prev.map((id) => (id === pendingId ? created.id : id)));
      } catch (err) {
        setPostsById((prev) => without(prev, [pendingId]));
        setRecentIds((prev) => prev.filter((id) => id !== pendingId));
        bumpReplies(parentId, -1);
        toast.error(errorMessage(err, "Failed to publish post"));
      }
    },
    [token, me, bumpReplies],
  );

  const deletePost = useCallback(
    async (postId: string) => {
      const post = postsRef.current[postId];
      if (!token || !post || isPendingPost(postId)) return false;

      const replyIds = Object.values(postsRef.current)
        .filter((p) => p.parentId === postId)
        .map((p) => p.id);
      const removed = [post, ...replyIds.map((id) => postsRef.current[id])];

      setPostsById((prev) => without(prev, [postId, ...replyIds]));
      bumpReplies(post.parentId, -1);

      try {
        await deletePostRequest(token, postId);
        setRecentIds((prev) => prev.filter((id) => id !== postId));
        toast.success("Your post was deleted");
        return true;
      } catch (err) {
        cachePosts(removed);
        bumpReplies(post.parentId, 1);
        toast.error(errorMessage(err, "Failed to delete post"));
        return false;
      }
    },
    [token, bumpReplies, cachePosts],
  );

  const toggleReaction = useCallback(
    async (kind: Reaction, postId: string) => {
      const post = postsRef.current[postId];
      if (!token || !post || isPendingPost(postId)) return;

      const { flag, count } = REACTION_FIELDS[kind];
      const was = !!post[flag];
      const apply = (active: boolean, n?: number) =>
        patchPost(postId, { [flag]: active, ...(count && n !== undefined ? { [count]: n } : {}) });

      apply(!was, count ? post[count] + (was ? -1 : 1) : undefined);

      try {
        const result = await setReaction(token, postId, kind, !was);
        apply(result.active, count ? result.count : undefined);
        if (kind === "bookmark") toast(result.active ? "Added to your bookmarks" : "Removed from your bookmarks");
      } catch (err) {
        apply(was, count ? post[count] : undefined);
        toast.error(errorMessage(err, `Failed to update ${kind}`));
      }
    },
    [token, patchPost],
  );

  const toggleLike = useCallback((postId: string) => void toggleReaction("like", postId), [toggleReaction]);
  const toggleRepost = useCallback((postId: string) => void toggleReaction("repost", postId), [toggleReaction]);
  const toggleBookmark = useCallback((postId: string) => void toggleReaction("bookmark", postId), [toggleReaction]);

  const followingRef = useRef(following);
  useEffect(() => {
    followingRef.current = following;
  }, [following]);

  const toggleFollow = useCallback(
    async (author: Author) => {
      const userId = author.id;
      if (!token || !userId || userId === me.id) return;

      const was = followingRef.current.has(userId);
      const apply = (on: boolean) =>
        setFollowingIds((prev) => {
          const next = new Set(prev);
          if (on) next.add(userId);
          else next.delete(userId);
          return next;
        });

      apply(!was);
      try {
        const result = await setFollowing(token, userId, !was);
        apply(result.following);
      } catch (err) {
        apply(was);
        toast.error(errorMessage(err, `Failed to ${was ? "unfollow" : "follow"} @${author.handle}`));
      }
    },
    [token, me.id],
  );

  const markAllRead = useCallback(() => {
    if (!token) return;
    readEpoch.current += 1;
    setUnreadCount(0);
    markNotificationsRead(token).catch((err) => console.error("Failed to mark notifications read", err));
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      ready,
      error,
      postsById,
      recentIds,
      incomingIds,
      incomingNotifications,
      cachePosts,
      publish,
      deletePost,
      toggleLike,
      toggleRepost,
      toggleBookmark,
      following,
      toggleFollow,
      unreadCount,
      markAllRead,
    }),
    [
      token,
      ready,
      error,
      postsById,
      recentIds,
      incomingIds,
      incomingNotifications,
      cachePosts,
      publish,
      deletePost,
      toggleLike,
      toggleRepost,
      toggleBookmark,
      following,
      toggleFollow,
      unreadCount,
      markAllRead,
    ],
  );

  return <SquareContext.Provider value={value}>{children}</SquareContext.Provider>;
}

export function useSquare() {
  const ctx = useContext(SquareContext);
  if (!ctx) throw new Error("useSquare must be used within a SquareProvider");
  return ctx;
}
