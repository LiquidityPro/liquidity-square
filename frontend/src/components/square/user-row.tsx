"use client";

import Link from "next/link";
import { Avatar, Verified } from "./avatar";
import { cn } from "@/lib/utils";
import { useSquare } from "./context";
import type { Author } from "./data";
import { profilePath } from "./post-card";
import { useCurrentAuthor } from "./use-current-author";

export function FollowButton({ author, className }: { author: Author; className?: string }) {
  const me = useCurrentAuthor();
  const { following, toggleFollow } = useSquare();
  if (!author.id || author.id === me.id) return null;
  const on = following.has(author.id);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFollow(author);
      }}
      aria-pressed={on}
      aria-label={`${on ? "Unfollow" : "Follow"} @${author.handle}`}
      className={cn(
        "group/follow min-h-9 min-w-[88px] shrink-0 rounded-full px-4 text-sm font-bold transition active:scale-[0.96]",
        on
          ? "border border-border text-foreground hover:border-bear hover:bg-bear/10 hover:text-bear"
          : "bg-foreground text-background hover:opacity-90",
        className,
      )}
    >
      {on ? (
        <>
          <span className="group-hover/follow:hidden">Following</span>
          <span className="hidden group-hover/follow:inline">Unfollow</span>
        </>
      ) : (
        "Follow"
      )}
    </button>
  );
}

export function UserRow({ author, className }: { author: Author; className?: string }) {
  const href = profilePath(author);
  const content = (
    <>
      <Avatar author={author} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate font-semibold">
          <span className="truncate group-hover/row:underline">{author.name}</span>
          {author.verified && <Verified />}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          @{author.handle}
          {author.role && ` · ${author.role}`}
        </p>
      </div>
      <FollowButton author={author} />
    </>
  );
  const rowClass = cn("group/row flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background/60", className);

  return href ? (
    <Link href={href} className={rowClass}>
      {content}
    </Link>
  ) : (
    <div className={rowClass}>{content}</div>
  );
}
