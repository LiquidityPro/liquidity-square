import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { AUTHORS, type Post, extractTickers, type Stance } from "./data";
import { createPost, fetchPosts, setPostLiked } from "./api";
import { useCurrentAuthor } from "./use-current-author";

type SquareContextType = {
  posts: Post[];
  loading: boolean;
  error: string | null;
  following: Set<string>;
  toggleFollow: (handle: string) => void;
  handlePost: (body: string, stance: Stance) => void;
  toggleLike: (postId: string) => void;
};

const SquareContext = createContext<SquareContextType | null>(null);

const PENDING_PREFIX = "pending-";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function SquareProvider({ children }: { children: ReactNode }) {
  const me = useCurrentAuthor();
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(
    () => new Set([AUTHORS.analyst1.handle, AUTHORS.macro.handle])
  );
  // The session loads asynchronously, so the user's own handle is added here rather than in initial state.
  const following = useMemo(() => new Set([...followed, me.handle]), [followed, me.handle]);

  useEffect(() => {
    if (status === "loading") return;
    if (!token) {
      setLoading(false);
      setError("Your session has no API token. Sign out and sign in again.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchPosts(token)
      .then((loaded) => {
        if (cancelled) return;
        setPosts(loaded);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "Failed to load posts")))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [status, token]);

  const toggleFollow = (handle: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  };

  const handlePost = async (body: string, stance: Stance) => {
    if (!token) return;
    const pendingId = `${PENDING_PREFIX}${Date.now()}`;
    setPosts((prev) => [
      {
        id: pendingId,
        author: me,
        time: "now",
        body,
        stance,
        tickers: extractTickers(body),
        replies: 0,
        reposts: 0,
        likes: 0,
      },
      ...prev,
    ]);

    try {
      const created = await createPost(token, body, stance);
      setPosts((prev) => prev.map((p) => (p.id === pendingId ? created : p)));
    } catch (err) {
      setPosts((prev) => prev.filter((p) => p.id !== pendingId));
      setError(errorMessage(err, "Failed to publish post"));
    }
  };

  const toggleLike = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!token || !post || postId.startsWith(PENDING_PREFIX)) return;

    const applyLike = (likedByMe: boolean, likes: number) =>
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likedByMe, likes } : p)));

    const liked = !post.likedByMe;
    applyLike(liked, post.likes + (liked ? 1 : -1));

    try {
      const result = await setPostLiked(token, postId, liked);
      applyLike(result.liked, result.likes);
    } catch (err) {
      applyLike(!!post.likedByMe, post.likes);
      setError(errorMessage(err, "Failed to update like"));
    }
  };

  return (
    <SquareContext.Provider
      value={{ posts, loading, error, following, toggleFollow, handlePost, toggleLike }}
    >
      {children}
    </SquareContext.Provider>
  );
}

export function useSquare() {
  const ctx = useContext(SquareContext);
  if (!ctx) throw new Error("useSquare must be used within a SquareProvider");
  return ctx;
}
