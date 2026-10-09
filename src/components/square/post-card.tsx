"use client";

import { useState, type ReactNode } from "react";
import { Bookmark, Ellipsis, Heart, Lock, MessageCircle, Repeat2, Share, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, Verified } from "./avatar";
import { cn } from "@/lib/utils";
import { TICKER_RE, compact, type Post, type Stance } from "./data";

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

/* ------------------------------------------------------------------ */
/* Post card                                                           */
/* ------------------------------------------------------------------ */

export function PostCard({ post, onTicker }: { post: Post; onTicker: (t: string) => void }) {
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <article className="group flex gap-3 border-b px-4 py-3 transition-colors hover:bg-card/60 animate-in fade-in slide-in-from-top-1">
      <Avatar author={post.author} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-1.5 text-[0.95rem]">
          <span className="truncate font-semibold">{post.author.name}</span>
          {post.author.verified && <Verified role={post.author.role} />}
          <span className="truncate font-mono text-xs text-muted-foreground">
            @{post.author.handle} · {post.time}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <StanceTag stance={post.stance} />
            <button
              type="button"
              aria-label="More options"
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <Ellipsis className="size-4" />
            </button>
          </span>
        </header>

        <p className="mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
          <RichText text={post.body} onTicker={onTicker} />
        </p>

        {post.poll && <PollBlock poll={post.poll} onTicker={onTicker} />}
        {post.room && <RoomBlock room={post.room} />}

        <div className="-ml-2 mt-2 flex max-w-md justify-between text-muted-foreground">
          <Action icon={<MessageCircle className="size-[18px]" />} label="Reply" count={post.replies} hover="primary" />
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
            count={post.likes + (liked ? 1 : 0)}
            active={liked}
            activeClass="text-bear"
            hover="bear"
            onClick={() => setLiked((v) => !v)}
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
            count={post.reposts + (reposted ? 1 : 0)}
            active={reposted}
            activeClass="text-primary"
            hover="primary"
            onClick={() => setReposted((v) => !v)}
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
            onClick={() => setSaved((v) => !v)}
          />
          <Action icon={<Share className="size-[18px]" />} label="Share" hover="primary" />
        </div>
      </div>
    </article>
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
      onClick={onClick}
      aria-label={count !== undefined ? `${label} (${count})` : label}
      aria-pressed={onClick ? !!active : undefined}
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

/* ------------------------------------------------------------------ */
