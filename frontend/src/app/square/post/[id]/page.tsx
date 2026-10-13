"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Composer, EmptyState, PageHeader, PostCard, PostFeed, PostSkeleton } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchPost, fetchReplies } from "@/components/square/api";
import type { Post } from "@/components/square/data";
import { usePostList } from "@/components/square/use-post-list";

export default function PostPage() {
  return (
    <Suspense fallback={<PostSkeleton count={1} />}>
      <PostThread />
    </Suspense>
  );
}

function PostThread() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const wantsReply = useSearchParams().get("reply") === "1";
  const { token, ready, postsById, cachePosts, publish } = useSquare();
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    setStatus("loading");
    fetchPost(token, id)
      .then(({ post, parent }) => {
        if (cancelled) return;
        cachePosts(parent ? [post, parent] : [post]);
        setParentId(parent?.id ?? null);
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setStatus(/not found/i.test(err.message) ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, token, ready, cachePosts]);

  const fetchPage = useCallback((t: string, cursor: string | null) => fetchReplies(t, id, cursor), [id]);
  const isReply = useCallback((p: Post) => p.parentId === id, [id]);
  const replies = usePostList({
    key: `replies:${id}`,
    fetchPage,
    includeRecent: isReply,
    recentAt: "bottom",
    enabled: status === "ready",
  });

  const post = postsById[id];
  const parent = parentId ? postsById[parentId] : undefined;

  function focusReply() {
    document.getElementById("square-composer")?.focus();
  }

  return (
    <>
      <PageHeader title="Post" back />

      {status === "loading" && !post ? (
        <PostSkeleton count={1} />
      ) : !post ? (
        <EmptyState
          title={status === "missing" || status === "ready" ? "This post is gone" : "Couldn't load this post"}
          body={status === "error" ? error : "It may have been deleted by its author."}
        />
      ) : (
        <>
          {parent && <PostCard post={parent} threadLine />}
          <PostCard
            post={post}
            variant="detail"
            onReply={focusReply}
            onDeleted={() => (parent ? router.replace(`/square/post/${parent.id}`) : router.replace("/square"))}
          />
          <Composer
            key={id}
            onPost={(body, stance) => publish(body, stance, id)}
            placeholder={`Reply to @${post.author.handle}`}
            submitLabel="Reply"
            autoFocus={wantsReply}
          />
          <PostFeed
            list={replies}
            endLabel="End of the thread"
            empty={<EmptyState title="No replies yet" body="Start the conversation." />}
          />
        </>
      )}
    </>
  );
}
