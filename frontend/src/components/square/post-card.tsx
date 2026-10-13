"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LuBookmark as Bookmark,
  LuEllipsis as Ellipsis,
  LuHeart as Heart,
  LuLink as LinkIcon,
  LuLock as Lock,
  LuMessageCircle as MessageCircle,
  LuRepeat2 as Repeat2,
  LuShare as Share,
  LuTrash2 as Trash,
  LuTrendingDown as TrendingDown,
  LuTrendingUp as TrendingUp,
  LuUserMinus as UserMinus,
  LuUserPlus as UserPlus,
} from "react-icons/lu";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Avatar, Verified } from "./avatar";
import { cn } from "@/lib/utils";
import { isPendingPost, useSquare } from "./context";
import { TICKER_RE, compact, type Author, type Post, type Stance } from "./data";
import { useCurrentAuthor } from "./use-current-author";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const postPath = (id: string) => `/square/post/${id}`;
export const profilePath = (author: Author) => (author.id ? `/square/u/${author.id}` : undefined);

export async function copyPostLink(id: string) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${postPath(id)}`);
    toast("Link copied to clipboard");
  } catch {
    toast.error("Couldn't copy the link");
  }
}

/* Post body with clickable $TICKERS                                   */
/* ------------------------------------------------------------------ */

function RichText({ text, onTicker }: { text: string; onTicker: (t: string) => void }) {
  return (
    <>
      {text.split(TICKER_RE).map((part, i) =>
        /^\$[A-Z]{2,12}$/.test(part) ? (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTicker(part.slice(1));
            }}
            className="font-mono text-primary hover:underline"
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function StanceTag({ stance }: { stance: Stance }) {
  if (!stance) return null;
  const bull = stance === "bull";
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center gap-1 rounded px-1.5 py-0.5 !text-[0.62rem]",
        bull ? "bg-primary/15 text-primary" : "bg-bear/15 text-bear",
      )}
    >
      {bull ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {bull ? "Bullish" : "Bearish"}
    </span>
  );
}

function AuthorLink({ author, className, children }: { author: Author; className?: string; children: ReactNode }) {
  const href = profilePath(author);
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

function ReplyingTo({ author }: { author: Author }) {
  return (
    <p className="text-sm text-muted-foreground">
      Replying to{" "}
      <AuthorLink author={author} className="font-mono text-primary hover:underline">
        @{author.handle}
      </AuthorLink>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Post card                                                           */
/* ------------------------------------------------------------------ */

type PostCardProps = {
  post: Post;
  onTicker?: (t: string) => void;
  /** Larger, non-clickable layout for the post detail page. */
  variant?: "feed" | "detail";
  /** Draws a connector from the avatar down to the next post in a thread. */
  threadLine?: boolean;
  onReply?: () => void;
  onDeleted?: () => void;
};

export function PostCard({ post, onTicker, variant = "feed", threadLine, onReply, onDeleted }: PostCardProps) {
  const router = useRouter();
  const pending = isPendingPost(post.id);
  const detail = variant === "detail";
  const goTicker = onTicker ?? ((t: string) => router.push(`/square/${t}`));

  function openPost(e: MouseEvent<HTMLElement>) {
    if (detail || pending) return;
    if ((e.target as HTMLElement).closest("a, button, [role='menuitem'], [role='dialog']")) return;
    if (window.getSelection()?.toString()) return;
    router.push(postPath(post.id));
  }

  const body = (
    <>
      <p
        className={cn(
          "whitespace-pre-wrap break-words",
          detail ? "mt-3 text-[1.2rem] leading-relaxed" : "mt-0.5 leading-relaxed",
        )}
      >
        <RichText text={post.body} onTicker={goTicker} />
      </p>
      {post.poll && <PollBlock poll={post.poll} onTicker={goTicker} />}
      {post.room && <RoomBlock room={post.room} />}
    </>
  );

  if (detail) {
    return (
      <article className="border-b px-4 pt-3 animate-in fade-in">
        <header className="flex items-center gap-3">
          <AuthorLink author={post.author}>
            <Avatar author={post.author} />
          </AuthorLink>
          <div className="min-w-0 flex-1">
            <AuthorLink author={post.author} className="flex items-center gap-1.5 font-semibold hover:underline">
              <span className="truncate">{post.author.name}</span>
              {post.author.verified && <Verified role={post.author.role} />}
            </AuthorLink>
            <p className="truncate font-mono text-xs text-muted-foreground">@{post.author.handle}</p>
          </div>
          <StanceTag stance={post.stance} />
          <PostMenu post={post} onDeleted={onDeleted} />
        </header>

        {post.replyTo && (
          <div className="mt-3">
            <ReplyingTo author={post.replyTo} />
          </div>
        )}
        {body}

        <p className="label-mono mt-4 text-muted-foreground">
          {post.createdAt ? fullTimestamp(post.createdAt) : post.time}
        </p>

        <div className="mt-3 flex gap-5 border-y py-3 text-sm">
          <Stat value={post.replies} label="Replies" />
          <Stat value={post.reposts} label="Reposts" />
          <Stat value={post.likes} label="Likes" />
        </div>

        <PostActions post={post} onReply={onReply} className="justify-around py-1" />
      </article>
    );
  }

  return (
    <article
      onClick={openPost}
      className={cn(
        "group relative flex gap-3 px-4 pt-3 transition-colors animate-in fade-in slide-in-from-top-1",
        !threadLine && "border-b pb-3",
        !pending && "cursor-pointer hover:bg-card/60",
        pending && "opacity-60",
      )}
    >
      <div className="flex shrink-0 flex-col items-center">
        <AuthorLink author={post.author}>
          <Avatar author={post.author} />
        </AuthorLink>
        {threadLine && <span aria-hidden="true" className="mt-1 w-0.5 flex-1 rounded-full bg-border" />}
      </div>
      <div className={cn("min-w-0 flex-1", threadLine && "pb-3")}>
        <header className="flex items-center gap-1.5 text-[0.95rem]">
          <AuthorLink author={post.author} className="truncate font-semibold hover:underline">
            {post.author.name}
          </AuthorLink>
          {post.author.verified && <Verified role={post.author.role} />}
          <span className="truncate font-mono text-xs text-muted-foreground">
            @{post.author.handle} ·{" "}
            {pending ? (
              post.time
            ) : (
              <Link href={postPath(post.id)} className="hover:underline" title={post.createdAt && fullTimestamp(post.createdAt)}>
                {post.time}
              </Link>
            )}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <StanceTag stance={post.stance} />
            <PostMenu post={post} onDeleted={onDeleted} />
          </span>
        </header>

        {post.replyTo && <ReplyingTo author={post.replyTo} />}
        {body}

        <PostActions
          post={post}
          onReply={onReply ?? (() => router.push(`${postPath(post.id)}?reply=1`))}
          className="-ml-2 mt-2 max-w-md justify-between"
        />
      </div>
    </article>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="text-muted-foreground">
      <span className="font-mono font-bold tabular-nums text-foreground">{compact(value)}</span> {label}
    </span>
  );
}

function fullTimestamp(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${time} · ${date}`;
}

/* Actions row                                                         */
/* ------------------------------------------------------------------ */

function PostActions({ post, onReply, className }: { post: Post; onReply?: () => void; className?: string }) {
  const { toggleLike, toggleRepost, toggleBookmark } = useSquare();
  const pending = isPendingPost(post.id);
  const liked = !!post.likedByMe;
  const reposted = !!post.repostedByMe;
  const saved = !!post.bookmarkedByMe;

  return (
    <div className={cn("flex text-muted-foreground", pending && "pointer-events-none", className)}>
      <Action
        icon={<MessageCircle className="size-[18px]" />}
        label="Reply"
        count={post.replies}
        hover="primary"
        onClick={onReply}
      />
      <Action
        icon={
          <motion.div
            initial={false}
            animate={{ rotate: reposted ? 180 : 0, scale: reposted ? 1.1 : 1 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
          >
            <Repeat2 className="size-[18px]" />
          </motion.div>
        }
        label="Repost"
        count={post.reposts}
        active={reposted}
        activeClass="text-primary"
        hover="primary"
        onClick={() => toggleRepost(post.id)}
      />
      <Action
        icon={
          <motion.div
            initial={false}
            animate={{ scale: liked ? 1.2 : 1 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
          >
            <Heart className={cn("size-[18px]", liked && "fill-current")} />
          </motion.div>
        }
        label="Like"
        count={post.likes}
        active={liked}
        activeClass="text-bear"
        hover="bear"
        onClick={() => toggleLike(post.id)}
      />
      <Action
        icon={
          <motion.div
            initial={false}
            animate={{ scale: saved ? 1.1 : 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.4 }}
          >
            <Bookmark className={cn("size-[18px]", saved && "fill-current")} />
          </motion.div>
        }
        label="Bookmark"
        active={saved}
        activeClass="text-primary"
        hover="primary"
        onClick={() => toggleBookmark(post.id)}
      />
      <Action
        icon={<Share className="size-[18px]" />}
        label="Share"
        hover="primary"
        onClick={() => copyPostLink(post.id)}
      />
    </div>
  );
}

function Action({
  icon,
  label,
  count,
  active,
  activeClass,
  hover,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  activeClass?: string;
  hover: "primary" | "bear";
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={count !== undefined ? `${label} (${count})` : label}
      aria-pressed={active !== undefined ? !!active : undefined}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", duration: 0.2 }}
      className={cn(
        "group/action flex min-h-9 items-center gap-1 rounded-full px-2 font-mono text-xs transition-colors",
        hover === "primary" ? "hover:text-primary" : "hover:text-bear",
        active && activeClass,
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full transition-all duration-300 ease-out",
          hover === "primary" ? "group-hover/action:bg-primary/10" : "group-hover/action:bg-bear/10",
        )}
      >
        {icon}
      </span>
      {count !== undefined && <span className="tabular-nums">{compact(count)}</span>}
    </motion.button>
  );
}

/* "..." menu with delete confirmation                                 */
/* ------------------------------------------------------------------ */

function PostMenu({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const me = useCurrentAuthor();
  const { following, toggleFollow, deletePost } = useSquare();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isPendingPost(post.id)) return null;

  const mine = !!me.id && post.author.id === me.id;
  const followsAuthor = !!post.author.id && following.has(post.author.id);

  async function confirmDelete() {
    setDeleting(true);
    const ok = await deletePost(post.id);
    setDeleting(false);
    setConfirmOpen(false);
    if (ok) onDeleted?.();
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More options"
            onClick={(e) => e.stopPropagation()}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary data-[state=open]:bg-primary/10 data-[state=open]:text-primary"
          >
            <Ellipsis className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
          className="min-w-56 rounded-xl border bg-background p-1 shadow-[0_8px_30px_-12px_var(--primary)]"
        >
          {mine ? (
            <DropdownMenuItem
              onSelect={() => setConfirmOpen(true)}
              className="cursor-pointer rounded-lg py-2 font-semibold text-bear focus:bg-bear/10 focus:text-bear"
            >
              <Trash /> Delete
            </DropdownMenuItem>
          ) : (
            post.author.id && (
              <DropdownMenuItem
                onSelect={() => toggleFollow(post.author)}
                className="cursor-pointer rounded-lg py-2 font-semibold"
              >
                {followsAuthor ? <UserMinus /> : <UserPlus />}
                {followsAuthor ? "Unfollow" : "Follow"} @{post.author.handle}
              </DropdownMenuItem>
            )
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => copyPostLink(post.id)}
            className="cursor-pointer rounded-lg py-2 font-semibold"
          >
            <LinkIcon /> Copy link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          className="max-w-xs rounded-2xl border bg-background p-6 sm:rounded-2xl"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold">Delete post?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. It will be removed from your profile, the timeline of anyone following you, and
              search results. Replies to it will be deleted too.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="min-h-11 w-full rounded-full bg-bear font-bold text-primary-foreground hover:bg-bear/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
            <AlertDialogCancel
              disabled={deleting}
              className="mt-0 min-h-11 w-full rounded-full font-bold sm:mt-0"
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* Polls and Pro rooms (preview content)                               */
/* ------------------------------------------------------------------ */

function PollBlock({ poll, onTicker }: { poll: NonNullable<Post["poll"]>; onTicker: (t: string) => void }) {
  const [vote, setVote] = useState<number | null>(null);
  const options = poll.options.map((o, i) => ({ ...o, votes: o.votes + (vote === i ? 1 : 0) }));
  const total = options.reduce((s, o) => s + o.votes, 0);

  return (
    <div className="mt-3 rounded-xl border p-3">
      <p className="mb-2 font-medium">
        <RichText text={poll.question} onTicker={onTicker} />
      </p>
      <div className="space-y-2">
        {options.map((o, i) => {
          const pct = Math.round((o.votes / total) * 100);
          return vote === null ? (
            <button
              key={o.label}
              type="button"
              onClick={() => setVote(i)}
              className="w-full rounded-full border border-primary/50 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
            >
              {o.label}
            </button>
          ) : (
            <div key={o.label} className="relative overflow-hidden rounded-md">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", duration: 0.8, bounce: 0.2 }}
                className={cn("absolute inset-y-0 left-0", vote === i ? "bg-primary/30" : "bg-muted-foreground/20")}
              />
              <div className="relative flex justify-between px-3 py-1.5 text-sm">
                <span className={cn(vote === i && "font-semibold")}>{o.label}</span>
                <span className="font-mono">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="label-mono mt-2 text-muted-foreground">
        {compact(total)} votes · Illustrative
      </p>
    </div>
  );
}

function RoomBlock({ room }: { room: NonNullable<Post["room"]> }) {
  return (
    <div className="mt-3 rounded-xl bg-paper p-4 text-paper-foreground">
      <div className="flex items-center justify-between">
        <span className="label-mono">Pro room · {room.analyst}</span>
        <span className="label-mono inline-flex items-center gap-1 rounded bg-paper-foreground px-2 py-0.5 text-paper">
          <Lock className="size-3" /> Locked
        </span>
      </div>
      <p className="mt-2 font-display text-lg font-bold">{room.title}</p>
      <div className="mt-3 space-y-1.5" aria-hidden="true">
        <div className="h-2.5 w-full rounded bg-paper-foreground/15" />
        <div className="h-2.5 w-4/5 rounded bg-paper-foreground/15" />
      </div>
      <p className="label-mono mt-3 opacity-70">Liquidity Pro · coming soon</p>
    </div>
  );
}
