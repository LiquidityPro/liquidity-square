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
import { toast } from "sonner";
import { type Author, type NotificationType, type Post, type SquareNotification, extractTickers, notificationLink, type Stance } from "./data";
import {
  createPost,
  deletePost as deletePostRequest,
  fetchFollowing,
  markNotificationsRead,
  setFollowing,
  setReaction,
  syncDisclosures,
  voteOnPoll,
  type ChatMessage,
  type LiveUpdate,
  type PollDraft,
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
  publish: (
    body: string,
    stance: Stance,
    parentId?: string | null,
    extras?: { quoteId?: string | null; poll?: PollDraft | null },
  ) => Promise<void>;
  votePoll: (postId: string, optionId: string) => Promise<void>;
  hideAuthor: (authorId: string) => void;
  deletePost: (postId: string) => Promise<boolean>;
  toggleLike: (postId: string) => void;
  toggleRepost: (postId: string) => void;
  toggleBookmark: (postId: string) => void;
  /** IDs of users the current user follows. */
  following: Set<string>;
  toggleFollow: (author: Author) => void;
  unreadCount: number;
  /** Conversations with a message you have not opened. */
  unreadMessages: number;
  setUnreadMessages: (count: number) => void;
  /** Direct messages that arrived while this session was open, oldest first. */
  incomingMessages: ChatMessage[];
  /** When the other person last opened each conversation. */
  peerReads: Record<string, string>;
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
  quote: "quoted your post",
  alert: "sent a price alert",
  disclosure: "filed on the NGX",
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
  bookmark: { flag: "bookmarkedByMe", count: "bookmarks" },
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [incomingMessages, setIncomingMessages] = useState<ChatMessage[]>([]);
  const [peerReads, setPeerReads] = useState<Record<string, string>>({});
  const readEpoch = useRef(0);

  const postsRef = useRef(postsById);
  useEffect(() => {
    postsRef.current = postsById;
  }, [postsById]);

  const error = ready && status === "authenticated" && !token ? "Your session has no API token. Sign out and sign in again." : null;

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
    setUnreadMessages(0);
    setIncomingIds([]);
    setIncomingNotifications([]);
    setIncomingMessages([]);
    setPeerReads({});
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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    syncDisclosures(token)
      .then(({ notifications }) => {
        if (cancelled || notifications.length === 0) return;
        addIncomingNotifications(notifications);
        for (const item of notifications) {
          if (!claimToast(item.id)) continue;
          const link = notificationLink(item);
          toast(item.summary || "New NGX filing", {
            description: item.symbol ? `$${item.symbol}` : undefined,
            duration: 8000,
            action: {
              label: "View",
              onClick: () => {
                if (link.external) window.open(link.href, "_blank", "noopener,noreferrer");
                else router.push(link.href);
              },
            },
          });
        }
      })
      .catch((err) => console.error("Disclosure sync failed", err));
    return () => {
      cancelled = true;
    };
  }, [token, addIncomingNotifications, router]);

  const livePrimed = useRef(false);

  const applyLive = useCallback(
    (update: LiveUpdate, epochAtStart: number) => {
      const baseline = !livePrimed.current;
      livePrimed.current = true;
      startTransition(() => {
        if (update.posts.length > 0) addIncomingPosts(update.posts);
        if (update.notifications.length > 0) addIncomingNotifications(update.notifications);
        if (update.messages.length > 0) {
          setIncomingMessages((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            const fresh = update.messages.filter((item) => !seen.has(item.id));
            if (fresh.length === 0) return prev;
            return [...prev, ...fresh].slice(-100);
          });
        }
        if (update.reads.length > 0) {
          setPeerReads((prev) => {
            const next = { ...prev };
            for (const read of update.reads) {
              const current = next[read.conversationId];
              if (!current || Date.parse(read.readAt) > Date.parse(current)) next[read.conversationId] = read.readAt;
            }
            return next;
          });
        }
        if (epochAtStart === readEpoch.current) setUnreadCount(update.unreadCount);
        setUnreadMessages(update.unreadMessages);
      });
      for (const item of update.notifications) {
        if (baseline) {
          claimToast(item.id);
          continue;
        }
        if (document.visibilityState !== "visible" || !claimToast(item.id)) continue;
        const link = notificationLink(item);
        const filing = item.type === "alert" || item.type === "disclosure";
        toast(filing && item.summary ? item.summary : `${item.actor.name} ${NOTIFICATION_COPY[item.type]}`, {
          description: filing ? (item.symbol ? `$${item.symbol}` : undefined) : item.post?.body,
          duration: 8000,
          action: {
            label: "View",
            onClick: () => {
              if (link.external) window.open(link.href, "_blank", "noopener,noreferrer");
              else router.push(link.href);
            },
          },
        });
      }
      for (const message of update.messages) {
        if (baseline || message.mine) continue;
        if (window.location.pathname === `/square/messages/${message.conversationId}`) continue;
        if (document.visibilityState !== "visible" || !claimToast(message.id)) continue;
        toast(`${message.sender.name} sent you a message`, {
          description: message.body,
          duration: 8000,
          action: {
            label: "View",
            onClick: () => router.push(`/square/messages/${message.conversationId}`),
          },
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
    async (
      body: string,
      stance: Stance,
      parentId: string | null = null,
      extras?: { quoteId?: string | null; poll?: PollDraft | null },
    ) => {
      if (!token) return;
      const pendingId = `${PENDING_PREFIX}${Date.now()}`;
      const quoted = extras?.quoteId ? postsRef.current[extras.quoteId] : null;
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
        bookmarks: 0,
        parentId,
        replyTo: parentId ? (postsRef.current[parentId]?.author ?? null) : null,
        quote: quoted
          ? {
              id: quoted.id,
              author: quoted.author,
              body: quoted.body,
              stance: quoted.stance,
              tickers: quoted.tickers,
              createdAt: quoted.createdAt,
              time: quoted.time,
            }
          : null,
        poll: extras?.poll
          ? {
              totalVotes: 0,
              myOptionId: null,
              options: extras.poll.options.map((option) => ({ ...option, votes: 0 })),
            }
          : null,
      };

      setPostsById((prev) => ({ ...prev, [pendingId]: pending }));
      setRecentIds((prev) => [pendingId, ...prev]);
      bumpReplies(parentId, 1);

      try {
        const created = await createPost(token, {
          body,
          stance,
          parentId,
          quoteId: extras?.quoteId,
          poll: extras?.poll,
        });
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
      const current = count ? Number(post[count] ?? 0) : 0;

      apply(!was, count ? current + (was ? -1 : 1) : undefined);

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

  const hideAuthor = useCallback((authorId: string) => {
    const removed = new Set(
      Object.values(postsRef.current)
        .filter((post) => post.author.id === authorId)
        .map((post) => post.id),
    );
    setPostsById((prev) => {
      const next = { ...prev };
      for (const id of removed) delete next[id];
      return next;
    });
    setRecentIds((prev) => prev.filter((id) => !removed.has(id)));
    setIncomingIds((prev) => prev.filter((id) => !removed.has(id)));
  }, []);

  const votePoll = useCallback(
    async (postId: string, optionId: string) => {
      const post = postsRef.current[postId];
      if (!token || !post?.poll || isPendingPost(postId)) return;
      const previous = post.poll;
      try {
        const poll = await voteOnPoll(token, postId, optionId);
        patchPost(postId, { poll });
      } catch (err) {
        patchPost(postId, { poll: previous });
        toast.error(errorMessage(err, "Failed to record your vote"));
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
      votePoll,
      hideAuthor,
      deletePost,
      toggleLike,
      toggleRepost,
      toggleBookmark,
      following,
      toggleFollow,
      unreadCount,
      unreadMessages,
      setUnreadMessages,
      incomingMessages,
      peerReads,
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
      incomingMessages,
      peerReads,
      cachePosts,
      publish,
      votePoll,
      hideAuthor,
      deletePost,
      toggleLike,
      toggleRepost,
      toggleBookmark,
      following,
      toggleFollow,
      unreadCount,
      unreadMessages,
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
