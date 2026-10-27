"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LuBookmark as Bookmark,
  LuEllipsis as Ellipsis,
  LuHeart as Heart,
  LuLink as LinkIcon,
  LuLock as Lock,
  LuMessageCircle as MessageCircle,
  LuBan as Ban,
  LuFlag as Flag,
  LuQuote as Quote,
  LuRepeat2 as Repeat2,
  LuShare as Share,
  LuTrash2 as Trash,
  LuVolumeX as VolumeX,
  LuTrendingDown as TrendingDown,
  LuTrendingUp as TrendingUp,
  LuUserMinus as UserMinus,
  LuUserPlus as UserPlus,
} from "react-icons/lu";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { roomHref } from "./x-samples";
import { Avatar, Verified } from "./avatar";
import { cn } from "@/lib/utils";
import { isPendingPost, useSquare } from "./context";
import { fetchEngagement, setBlocked, setMuted } from "./api";
import { UserRow } from "./user-row";
import { Composer } from "./composer";
import { ReportDialog } from "./safety";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authorBadge, compact, type Author, type Post, type Stance } from "./data";
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

const RICH_RE = /(\$[A-Z]{2,12}|@[A-Za-z0-9_]{1,30})/g;

function RichText({ text, onTicker }: { text: string; onTicker: (t: string) => void }) {
  return (
    <>
      {text.split(RICH_RE).map((part, i) => {
        if (/^\$[A-Z]{2,12}$/.test(part)) {
          return (
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
          );
        }
        if (/^@[A-Za-z0-9_]{1,30}$/.test(part)) {
          return (
            <Link
              key={i}
              href={`/square/u/${part.slice(1).toLowerCase()}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline"
            >
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
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

function RepostedBy({ author }: { author: Author }) {
  const me = useCurrentAuthor();
  const mine = !!author.id && author.id === me.id;
  return (
    <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
      <Repeat2 className="size-3.5" aria-hidden="true" />
      {mine ? (
        "You reposted"
      ) : (
        <>
          <AuthorLink author={author} className="hover:underline">
            {author.name}
          </AuthorLink>{" "}
          reposted
        </>
      )}
    </p>
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
  /** Set on a profile Reposts tab so the card says who reposted it. */
  repostedBy?: Author;
};

export function PostCard({ post, onTicker, variant = "feed", threadLine, onReply, onDeleted, repostedBy }: PostCardProps) {
  const router = useRouter();
  const [quoting, setQuoting] = useState(false);
  const [peopleKind, setPeopleKind] = useState<"likes" | "reposts" | null>(null);
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
      {post.poll && <PollBlock postId={post.id} poll={post.poll} onTicker={goTicker} />}
      {post.quote && <QuoteEmbed quote={post.quote} />}
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
              {authorBadge(post.author) && <Verified badge={authorBadge(post.author)!} role={post.author.role} />}
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

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-y py-3 text-sm">
          <Stat value={post.replies} label={post.replies === 1 ? "Reply" : "Replies"} />
          <Stat value={post.reposts} label={post.reposts === 1 ? "Repost" : "Reposts"} onOpen={() => setPeopleKind("reposts")} />
          <Stat value={post.likes} label={post.likes === 1 ? "Like" : "Likes"} onOpen={() => setPeopleKind("likes")} />
          <Stat value={post.bookmarks ?? 0} label={(post.bookmarks ?? 0) === 1 ? "Bookmark" : "Bookmarks"} />
        </div>

        <PostActions
          post={post}
          onReply={onReply}
          onQuote={() => setQuoting(true)}
          onPeople={setPeopleKind}
          className="justify-around py-1"
        />
        <QuoteComposer post={post} open={quoting} onOpenChange={setQuoting} />
        <PeopleDialog postId={post.id} kind={peopleKind} onClose={() => setPeopleKind(null)} />
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
        {repostedBy && <RepostedBy author={repostedBy} />}
        <header className="flex items-center gap-1.5 text-[0.95rem]">
          <AuthorLink author={post.author} className="truncate font-semibold hover:underline">
            {post.author.name}
          </AuthorLink>
          {authorBadge(post.author) && <Verified badge={authorBadge(post.author)!} role={post.author.role} />}
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
          onQuote={() => setQuoting(true)}
          onPeople={setPeopleKind}
          className="-ml-2 mt-2 max-w-md justify-between"
        />
        <QuoteComposer post={post} open={quoting} onOpenChange={setQuoting} />
        <PeopleDialog postId={post.id} kind={peopleKind} onClose={() => setPeopleKind(null)} />
      </div>
    </article>
  );
}

function Stat({ value, label, onOpen }: { value: number; label: string; onOpen?: () => void }) {
  const text = (
    <>
      <span className="font-mono font-bold tabular-nums text-foreground">{compact(value)}</span> {label}
    </>
  );
  if (!onOpen || value === 0) return <span className="text-muted-foreground">{text}</span>;
  return (
    <button type="button" onClick={onOpen} className="text-muted-foreground hover:underline">
      {text}
    </button>
  );
}

function PeopleDialog({
  postId,
  kind,
  onClose,
}: {
  postId: string;
  kind: "likes" | "reposts" | null;
  onClose: () => void;
}) {
  const { token } = useSquare();
  const [people, setPeople] = useState<Author[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kind || !token) return;
    let cancelled = false;
    setPeople(null);
    setError(null);
    fetchEngagement(token, postId, kind)
      .then((rows) => {
        if (!cancelled) setPeople(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, postId, token]);

  return (
    <Dialog open={!!kind} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{kind === "reposts" ? "Reposts" : "Likes"}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{error}</p>
        ) : !people ? (
          <div className="space-y-3 px-4 py-4" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : people.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No one here yet.</p>
        ) : (
          <ul>
            {people.map((person) => (
              <li key={person.id ?? person.handle}>
                <UserRow author={person} />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
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

function PostActions({
  post,
  onReply,
  onQuote,
  onPeople,
  className,
}: {
  post: Post;
  onReply?: () => void;
  onQuote?: () => void;
  onPeople?: (kind: "likes" | "reposts") => void;
  className?: string;
}) {
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
        onCount={post.reposts > 0 ? () => onPeople?.("reposts") : undefined}
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
        onCount={post.likes > 0 ? () => onPeople?.("likes") : undefined}
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
        count={post.bookmarks ?? 0}
        active={saved}
        activeClass="text-primary"
        hover="primary"
        onClick={() => toggleBookmark(post.id)}
      />
      <Action
        icon={<Quote className="size-[18px]" />}
        label="Quote"
        hover="primary"
        onClick={onQuote}
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
  onCount,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  activeClass?: string;
  hover: "primary" | "bear";
  onClick?: () => void;
  onCount?: () => void;
}) {
  return (
    <div className={cn("flex items-center", active && activeClass)}>
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
        {count !== undefined && !onCount && <span className="tabular-nums">{compact(count)}</span>}
      </motion.button>
      {onCount && count !== undefined && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCount();
          }}
          aria-label={`See who ${label === "Like" ? "liked" : "reposted"} this`}
          className="min-h-9 rounded-full px-1 font-mono text-xs tabular-nums hover:underline"
        >
          {compact(count)}
        </button>
      )}
    </div>
  );
}

/* "..." menu with delete confirmation                                 */
/* ------------------------------------------------------------------ */

function PostMenu({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const me = useCurrentAuthor();
  const { token, following, toggleFollow, deletePost, hideAuthor } = useSquare();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);

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
          {!mine && post.author.id && (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  if (!token || !post.author.id) return;
                  void setMuted(token, post.author.id, true)
                    .then(() => {
                      hideAuthor(post.author.id!);
                      toast.success(`Muted @${post.author.handle}`);
                    })
                    .catch((error: Error) => toast.error(error.message));
                }}
                className="cursor-pointer rounded-lg py-2 font-semibold"
              >
                <VolumeX /> Mute @{post.author.handle}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  if (!token || !post.author.id) return;
                  void setBlocked(token, post.author.id, true)
                    .then(() => {
                      hideAuthor(post.author.id!);
                      toast.success(`Blocked @${post.author.handle}`);
                    })
                    .catch((error: Error) => toast.error(error.message));
                }}
                className="cursor-pointer rounded-lg py-2 font-semibold text-bear focus:bg-bear/10 focus:text-bear"
              >
                <Ban /> Block @{post.author.handle}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setReporting(true)}
                className="cursor-pointer rounded-lg py-2 font-semibold"
              >
                <Flag /> Report post
              </DropdownMenuItem>
            </>
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
      <ReportDialog open={reporting} onOpenChange={setReporting} postId={post.id} userId={post.author.id} />

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

function PollBlock({
  postId,
  poll,
  onTicker,
}: {
  postId: string;
  poll: NonNullable<Post["poll"]>;
  onTicker: (t: string) => void;
}) {
  const { votePoll } = useSquare();
  const live = poll.options.every((option) => option.id);
  const [localVote, setLocalVote] = useState<number | null>(null);
  const showResults = live ? !!poll.myOptionId : localVote != null;
  const options = poll.options.map((option, index) => ({
    ...option,
    votes: option.votes + (!live && localVote === index ? 1 : 0),
  }));
  const total = live ? (poll.totalVotes ?? options.reduce((sum, option) => sum + option.votes, 0)) : options.reduce((sum, option) => sum + option.votes, 0);

  return (
    <div className="mt-3 rounded-xl border p-3" onClick={(event) => event.stopPropagation()}>
      {poll.question && (
        <p className="mb-2 font-medium">
          <RichText text={poll.question} onTicker={onTicker} />
        </p>
      )}
      <div className="space-y-2">
        {options.map((option, index) => {
          const pct = total > 0 ? Math.round((option.votes / total) * 100) : 0;
          const selected = live ? option.id === poll.myOptionId : localVote === index;
          if (!showResults) {
            return (
              <button
                key={option.id ?? option.label}
                type="button"
                onClick={() => {
                  if (live && option.id) void votePoll(postId, option.id);
                  else setLocalVote(index);
                }}
                className="w-full rounded-full border border-primary/50 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
              >
                {option.label}
              </button>
            );
          }
          return (
            <button
              type="button"
              key={option.id ?? option.label}
              onClick={() => {
                if (live && option.id && option.id !== poll.myOptionId) void votePoll(postId, option.id);
              }}
              className="relative block w-full overflow-hidden rounded-md text-left"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", duration: 0.8, bounce: 0.2 }}
                className={cn("absolute inset-y-0 left-0", selected ? "bg-primary/30" : "bg-muted-foreground/20")}
              />
              <div className="relative flex justify-between px-3 py-1.5 text-sm">
                <span className={cn(selected && "font-semibold")}>{option.label}</span>
                <span className="font-mono">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="label-mono mt-2 text-muted-foreground">
        {compact(total)} {total === 1 ? "vote" : "votes"}
        {!live && " · Illustrative"}
      </p>
    </div>
  );
}

function QuoteEmbed({ quote }: { quote: NonNullable<Post["quote"]> }) {
  return (
    <Link
      href={postPath(quote.id)}
      onClick={(event) => event.stopPropagation()}
      className="mt-3 block rounded-xl border px-3 py-2 transition hover:bg-card/60"
    >
      <p className="truncate text-sm font-semibold">
        {quote.author.name}{" "}
        <span className="font-mono text-xs font-normal text-muted-foreground">@{quote.author.handle}</span>
      </p>
      <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{quote.body}</p>
    </Link>
  );
}

function QuoteComposer({
  post,
  open,
  onOpenChange,
}: {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { publish } = useSquare();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(event) => event.stopPropagation()} className="max-w-lg rounded-2xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Quote</DialogTitle>
        </DialogHeader>
        <Composer
          fieldId={`quote-${post.id}`}
          quoted={{
            id: post.id,
            author: post.author,
            body: post.body,
            stance: post.stance,
            tickers: post.tickers,
            createdAt: post.createdAt,
            time: post.time,
          }}
          autoFocus
          submitLabel="Quote"
          onPost={(body, stance, extras) => {
            void publish(body, stance, null, { ...extras, quoteId: post.id });
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RoomBlock({ room }: { room: NonNullable<Post["room"]> }) {
  return (
    <Link
      href={roomHref(room.title)}
      onClick={(event) => event.stopPropagation()}
      className="mt-3 block rounded-xl bg-paper p-4 text-paper-foreground transition hover:opacity-95"
    >
      <div className="flex items-center justify-between">
        <span className="label-mono">Pro room · {room.analyst}</span>
        <span className="label-mono inline-flex items-center gap-1 rounded bg-paper-foreground px-2 py-0.5 text-paper">
          <Lock className="size-3" /> Sample
        </span>
      </div>
      <p className="mt-2 font-display text-lg font-bold">{room.title}</p>
      <div className="mt-3 space-y-1.5" aria-hidden="true">
        <div className="h-2.5 w-full rounded bg-paper-foreground/15" />
        <div className="h-2.5 w-4/5 rounded bg-paper-foreground/15" />
      </div>
      <p className="label-mono mt-3 opacity-70">Open the sample room</p>
    </Link>
  );
}
