"use client";
import { EmptyState, PageHeader, PostFeed } from "@/components/square/parts";
import { fetchBookmarks } from "@/components/square/api";
import type { Post } from "@/components/square/data";
import { usePostList } from "@/components/square/use-post-list";
import { useCurrentAuthor } from "@/components/square/use-current-author";

const isBookmarked = (p: Post) => !!p.bookmarkedByMe;

export default function BookmarksPage() {
  const me = useCurrentAuthor();
  const list = usePostList({ key: "bookmarks", fetchPage: fetchBookmarks, keep: isBookmarked });

  return (
    <>
      <PageHeader title="Bookmarks" subtitle={`@${me.handle}`} />
      <PostFeed
        list={list}
        endLabel="That's everything you've saved"
        empty={
          <EmptyState
            title="Save posts for later"
            body="Bookmark theses and market calls to find them easily again. Only you can see your bookmarks."
          />
        }
      />
    </>
  );
}
