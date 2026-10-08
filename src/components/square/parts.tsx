import { forwardRef, useState, useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  ChartColumn,
  Ellipsis,
  Feather,
  Hash,
  Heart,
  House,
  Lock,
  MessageCircle,
  Moon,
  Repeat2,
  Search,
  Share,
  Sun,
  TrendingDown,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/site";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ME,
  SUGGESTED,
  TICKER_RE,
  TRENDING,
  TOP_MOVERS,
  compact,
  getTickerData,
  type Author,
  type Post,
  type Stance,
} from "./data";

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

const AVATAR_TONES = [
  "bg-[oklch(0.32_0.06_160)]",
  "bg-[oklch(0.32_0.06_200)]",
  "bg-[oklch(0.32_0.06_260)]",
  "bg-[oklch(0.33_0.06_40)]",
  "bg-[oklch(0.34_0.07_125)]",
];

function tone(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({ author, size = "md" }: { author: Author; size?: "sm" | "md" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-mono font-medium text-foreground",
        tone(author.handle),
        author.verified && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
        size === "md" ? "size-10 text-sm" : "size-8 text-xs",
      )}
    >
      {author.initials}
    </div>
  );
}

function Verified({ role }: { role?: string }) {
  const badge = <BadgeCheck className="size-4 shrink-0 fill-amber-400 text-amber-950" aria-label="Verified" />;
  
  if (!role) return badge;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex cursor-help items-center">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="border-border bg-card font-mono text-xs text-card-foreground shadow-xl">
          {role}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
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
/* Composer                                                            */
/* ------------------------------------------------------------------ */

const LIMIT = 280;

export const Composer = forwardRef<HTMLTextAreaElement, { onPost: (body: string, stance: Stance) => void; initialValue?: string }>(
  function Composer({ onPost, initialValue = "" }, ref) {
    const [body, setBody] = useState(initialValue);
    const [stance, setStance] = useState<Stance>(null);
    const left = LIMIT - body.length;
    const canPost = body.trim().length > 0 && left >= 0;
    const pct = Math.min(body.length / LIMIT, 1);

    function submit() {
      if (!canPost) return;
      onPost(body.trim(), stance);
      setBody("");
      setStance(null);
    }

    return (
      <div className="flex gap-3 border-b px-4 py-3">
        <Avatar author={ME} />
        <div className="min-w-0 flex-1">
          <label htmlFor="square-composer" className="sr-only">
            Write a post
          </label>
          <textarea
            id="square-composer"
            ref={ref}
            value={body}
            rows={2}
            onChange={(e) => {
              setBody(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="What's moving? Tag a ticker like $DANGCEM"
            className="w-full resize-none bg-transparent py-2 text-lg placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-1" role="group" aria-label="Your stance">
              <StanceButton current={stance} value="bull" onChange={setStance} />
              <StanceButton current={stance} value="bear" onChange={setStance} />
              <button
                type="button"
                aria-label="Add poll (coming soon)"
                title="Polls — coming soon"
                className="grid size-9 place-items-center rounded-full text-primary hover:bg-primary/10"
              >
                <ChartColumn className="size-[18px]" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              {body.length > 0 && (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke={left < 0 ? "var(--bear)" : left <= 20 ? "oklch(0.85 0.17 85)" : "var(--primary)"}
                      strokeWidth="2.5"
                      strokeDasharray={`${pct * 62.83} 62.83`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {left <= 20 && (
                    <span className={cn("font-mono text-xs", left < 0 ? "text-bear" : "text-muted-foreground")}>{left}</span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!canPost}
                className="min-h-9 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-40 enabled:active:scale-[0.96]"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

function StanceButton({
  current,
  value,
  onChange,
}: {
  current: Stance;
  value: "bull" | "bear";
  onChange: (s: Stance) => void;
}) {
  const on = current === value;
  const bull = value === "bull";
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(on ? null : value)}
      className={cn(
        "label-mono flex min-h-9 items-center gap-1 rounded-full border px-3 transition active:scale-[0.96]",
        bull
          ? on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-primary/40 text-primary hover:bg-primary/10"
          : on
            ? "border-bear bg-bear text-primary-foreground"
            : "border-bear/40 text-bear hover:bg-bear/10",
      )}
    >
      {bull ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {bull ? "Bull" : "Bear"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Left navigation                                                     */
/* ------------------------------------------------------------------ */

const NAV = [
  { icon: House, label: "Home", active: true },
  { icon: Hash, label: "Explore" },
  { icon: Bell, label: "Notifications", badge: "3" },
  { icon: Lock, label: "Pro rooms", soon: true },
  { icon: Bookmark, label: "Bookmarks" },
  { icon: User, label: "Profile" },
];

export function LeftNav({ onCompose }: { onCompose: () => void }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col justify-between px-2 py-3 sm:flex xl:w-[260px] xl:px-3">
      <div className="flex flex-col items-center gap-1 xl:items-stretch">
        <div className="mb-2 px-2 [&_span]:hidden xl:[&_span]:inline">
          <Logo />
        </div>
        <nav aria-label="Square navigation" className="flex flex-col items-center gap-1 xl:items-stretch">
          {NAV.map(({ icon: Icon, label, active, badge, soon }) => (
            <button
              key={label}
              type="button"
              aria-current={active ? "page" : undefined}
              title={active ? label : `${label} — coming soon`}
              className={cn(
                "relative flex min-h-12 items-center gap-4 rounded-full px-3 text-lg transition-colors hover:bg-card xl:pr-5",
                active ? "font-bold" : "text-foreground/85",
              )}
            >
              <Icon className={cn("size-6", active && "text-primary")} strokeWidth={active ? 2.5 : 2} />
              <span className="hidden xl:inline">{label}</span>
              {soon && (
                <span className="label-mono hidden rounded border border-primary/40 px-1.5 !text-[0.6rem] text-primary xl:inline">
                  Soon
                </span>
              )}
              {badge && (
                <span className="absolute left-7 top-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[0.6rem] font-bold text-primary-foreground">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={onCompose}
          className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shadow-[0_0_30px_-8px_var(--primary)] transition hover:opacity-90 active:scale-[0.96] max-xl:size-12 xl:text-lg"
        >
          <Feather className="size-5 xl:hidden" aria-hidden="true" />
          <span className="hidden xl:inline">Post</span>
          <span className="sr-only xl:hidden">Post</span>
        </button>
      </div>

      <div className="mt-auto mb-2 space-y-2">
        <ThemeToggle />
        <div className="flex items-center gap-3 rounded-full p-2 hover:bg-card">
          <Avatar author={ME} />
          <div className="hidden min-w-0 flex-1 xl:block">
            <p className="truncate text-sm font-semibold">{ME.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">@{ME.handle}</p>
          </div>
          <Ellipsis className="hidden size-4 text-muted-foreground xl:block" aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => 
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <button 
      onClick={() => setIsDark(!isDark)}
      className="flex w-full min-h-12 items-center gap-4 rounded-full px-3 text-lg transition-colors hover:bg-card text-foreground/85 xl:pr-5"
    >
       <div className="grid size-6 place-items-center">
         {isDark ? <Sun className="size-6" /> : <Moon className="size-6" />}
       </div>
       <span className="hidden xl:inline">Theme</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Right rail                                                          */
/* ------------------------------------------------------------------ */

export function SentimentBar({ bull, label }: { bull: number; label: string }) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full" role="img" aria-label={`${label}: ${bull}% bullish, ${100 - bull}% bearish (illustrative)`}>
        <div className="bg-primary transition-[width] duration-700" style={{ width: `${bull}%` }} />
        <div className="bg-bear" style={{ width: `${100 - bull}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.7rem]">
        <span className="text-primary">Bull {bull}%</span>
        <span className="text-bear">Bear {100 - bull}%</span>
      </div>
    </div>
  );
}

export function RightRail({
  onTicker,
  following,
  onToggleFollow,
  activeTicker,
}: {
  onTicker: (t: string) => void;
  following: Set<string>;
  onToggleFollow: (handle: string) => void;
  activeTicker?: string;
}) {
  const [q, setQ] = useState("");
  const tickerData = activeTicker ? getTickerData(activeTicker) : null;

  return (
    <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 flex-col gap-4 overflow-y-auto py-2 pl-6 lg:flex">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const t = q.trim().replace(/^\$/, "").toUpperCase();
          if (t) onTicker(t);
          setQ("");
        }}
        className="sticky top-0 z-10 bg-background/65 pb-1 pt-1 backdrop-blur-2xl backdrop-saturate-150"
      >
        <label htmlFor="square-search" className="sr-only">
          Search tickers
        </label>
        <div className="flex items-center gap-3 rounded-full border bg-card px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            id="square-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a ticker, e.g. MTNN"
            className="min-h-11 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </form>

      {activeTicker && tickerData ? (
        <section className="rounded-2xl border bg-card p-4 animate-in fade-in slide-in-from-right-2">
          <h2 className="mb-4 text-lg font-bold">About ${activeTicker}</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Market Cap</p>
              <p className="font-mono font-medium">{tickerData.marketCap}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">P/E Ratio</p>
              <p className="font-mono font-medium">{tickerData.peRatio}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="font-mono font-medium">{tickerData.volume}</p>
            </div>
          </div>

          <h3 className="mb-3 mt-6 text-sm font-bold text-muted-foreground">Recent Headlines</h3>
          <ul className="space-y-4">
            {tickerData.news.map((newsItem, idx) => (
              <li key={idx} className="group cursor-pointer">
                <p className="text-sm font-medium leading-snug group-hover:underline">
                  {newsItem.headline}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {newsItem.source} · {newsItem.time}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
        <section className="rounded-2xl border bg-card">
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <h2 className="text-xl font-bold">Trending on NGX</h2>
            <span className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground">Illustrative</span>
          </div>
          <ol>
            {TRENDING.map((t, i) => (
              <li key={t.ticker}>
                <button
                  type="button"
                  onClick={() => onTicker(t.ticker)}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-background/60"
                >
                  <p className="label-mono !text-[0.62rem] text-muted-foreground">
                    {i + 1} · {t.sector} · Trending
                  </p>
                  <p className="mt-0.5 font-mono font-semibold">${t.ticker}</p>
                  <p className="mb-2 text-xs text-muted-foreground">{t.posts}</p>
                  <SentimentBar bull={t.bull} label={`$${t.ticker} sentiment`} />
                </button>
              </li>
            ))}
          </ol>
        </section>
        
        <section className="rounded-2xl border bg-card pb-2">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <h2 className="text-xl font-bold">Top Movers</h2>
            <span className="label-mono rounded border px-1.5 py-0.5 !text-[0.6rem] text-muted-foreground">Today</span>
          </div>
          
          <div className="px-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary opacity-80">Gainers</h3>
            <ul className="mb-4 space-y-1">
              {TOP_MOVERS.gainers.map(m => (
                <motion.li 
                  key={m.ticker} 
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-background/80"
                  onClick={() => onTicker(m.ticker)}
                >
                  <div>
                    <button type="button" className="font-mono font-semibold text-sm">
                      ${m.ticker}
                    </button>
                    <p className="font-mono text-xs text-muted-foreground">₦{m.price.toFixed(2)}</p>
                  </div>
                  <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary shadow-sm border border-primary/20">+{m.change}%</span>
                </motion.li>
              ))}
            </ul>

            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-bear opacity-80">Losers</h3>
            <ul className="space-y-1">
              {TOP_MOVERS.losers.map(m => (
                <motion.li 
                  key={m.ticker} 
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-background/80"
                  onClick={() => onTicker(m.ticker)}
                >
                  <div>
                    <button type="button" className="font-mono font-semibold text-sm">
                      ${m.ticker}
                    </button>
                    <p className="font-mono text-xs text-muted-foreground">₦{m.price.toFixed(2)}</p>
                  </div>
                  <span className="rounded bg-bear/10 px-2 py-1 text-xs font-bold text-bear shadow-sm border border-bear/20">{m.change}%</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>
        </>
      )}

      <section className="rounded-2xl border bg-card pb-2">
        <h2 className="px-4 pb-1 pt-3 text-xl font-bold">Verified voices</h2>
        <ul>
          {SUGGESTED.map((a) => {
            const on = following.has(a.handle);
            return (
              <li key={a.handle} className="flex items-center gap-3 px-4 py-3">
                <Avatar author={a} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-semibold">
                    <span className="truncate">{a.name}</span>
                    {a.verified && <Verified />}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    @{a.handle} · {a.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFollow(a.handle)}
                  aria-pressed={on}
                  className={cn(
                    "group/follow min-h-9 min-w-[88px] rounded-full px-4 text-sm font-bold transition active:scale-[0.96]",
                    on
                      ? "border border-border text-foreground hover:border-bear hover:text-bear"
                      : "bg-foreground text-background hover:opacity-90",
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
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="label-mono text-primary">Preview</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The Square isn't open yet. Everything here is placeholder content.
        </p>
        <a
          href="/#join"
          className="mt-3 flex min-h-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground hover:opacity-90 active:scale-[0.96] transition"
        >
          Join the waitlist
        </a>
      </section>

      <nav className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-6 text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:underline">
          Privacy
        </Link>
        <Link to="/terms" className="hover:underline">
          Terms
        </Link>
        <span>© {new Date().getFullYear()} Liquidity Pro</span>
      </nav>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile bottom bar + floating compose                                */
/* ------------------------------------------------------------------ */

export function MobileBar({ onCompose }: { onCompose: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onCompose}
        aria-label="Write a post"
        className="fixed bottom-20 right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_30px_-6px_var(--primary)] transition active:scale-[0.96] sm:hidden"
      >
        <Feather className="size-6" />
      </button>
      <nav
        aria-label="Square navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background/65 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 sm:hidden"
      >
        {[House, Search, Bell, User].map((Icon, i) => (
          <button
            key={i}
            type="button"
            aria-label={["Home", "Search", "Notifications", "Profile"][i]}
            className="grid min-h-14 flex-1 place-items-center transition active:scale-[0.96]"
          >
            <Icon className={cn("size-6", i === 0 ? "text-primary" : "text-foreground/80")} />
          </button>
        ))}
        <MobileThemeToggle />
      </nav>
    </>
  );
}

export function TickerChip({ ticker, onClear }: { ticker: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 py-1 pl-3 pr-1 font-mono text-sm text-primary">
      ${ticker}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear $${ticker} filter`}
        className="grid size-6 place-items-center rounded-full hover:bg-primary/20"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

export function TickerTape() {
  const items = TRENDING.map((t) => {
    const data = getTickerData(t.ticker);
    return { ticker: t.ticker, price: data.price, change: data.change };
  });

  // Duplicate for seamless infinite scroll
  const tape = [...items, ...items, ...items];

  return (
    <div className="sticky top-0 z-50 overflow-hidden border-b bg-background/65 py-2.5 text-sm backdrop-blur-2xl backdrop-saturate-150 shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] supports-[backdrop-filter]:bg-background/50" aria-hidden="true">
      <div className="animate-ticker flex w-max gap-8 font-mono">
        {tape.map((item, i) => (
          <motion.div 
            key={i} 
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-0.5 transition-colors hover:bg-background/40"
          >
            <span className="font-bold opacity-90">${item.ticker}</span>
            <span className="font-medium opacity-75">₦{item.price.toFixed(2)}</span>
            <span className={cn(
              "font-bold drop-shadow-sm",
              item.change >= 0 ? "text-primary" : "text-bear"
            )}>
              {item.change >= 0 ? "+" : ""}{item.change}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function MobileThemeToggle() {
  const [isDark, setIsDark] = useState(() => 
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark(!isDark)}
      aria-label="Toggle Theme"
      className="grid min-h-14 flex-1 place-items-center transition active:scale-[0.96] text-foreground/80"
    >
      {isDark ? <Sun className="size-6" /> : <Moon className="size-6" />}
    </button>
  );
}
