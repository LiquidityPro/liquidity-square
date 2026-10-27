"use client";

import { LuBadgeCheck as BadgeCheck } from "react-icons/lu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { authorBadge, type Author, type Badge } from "./data";

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

const AVATAR_SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-24 text-2xl sm:size-32 sm:text-3xl",
};

export function Avatar({
  author,
  size = "md",
  className,
}: {
  author: Author;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-mono font-medium text-foreground",
        tone(author.handle),
        authorBadge(author) === "member" && "ring-2 ring-sky-400/70 ring-offset-2 ring-offset-background",
        authorBadge(author) === "professional" && "ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-background",
        authorBadge(author) === "distinguished" && "ring-2 ring-amber-400/80 ring-offset-2 ring-offset-background",
        AVATAR_SIZES[size],
        className,
      )}
    >
      {author.image ? (
        <img src={author.image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        author.initials
      )}
    </div>
  );
}

const BADGE_MARK: Record<Badge, { label: string; className: string }> = {
  member: { label: "Member", className: "fill-sky-400 text-sky-950" },
  professional: { label: "Professional", className: "fill-emerald-400 text-emerald-950" },
  distinguished: { label: "Distinguished", className: "fill-amber-400 text-amber-950" },
};

export function Verified({ badge = "professional", role }: { badge?: Badge; role?: string }) {
  const mark = BADGE_MARK[badge];
  const icon = <BadgeCheck className={cn("size-4 shrink-0", mark.className)} aria-label={mark.label} />;
  const tip = role ? `${mark.label} · ${role}` : mark.label;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex cursor-help items-center">{icon}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="border-border bg-card font-mono text-xs text-card-foreground shadow-xl">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
