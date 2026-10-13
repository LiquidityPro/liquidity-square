"use client";

import { LuBadgeCheck as BadgeCheck } from "react-icons/lu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Author } from "./data";

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

export function Avatar({ author, size = "md" }: { author: Author; size?: keyof typeof AVATAR_SIZES }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-mono font-medium text-foreground",
        tone(author.handle),
        author.verified && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
        AVATAR_SIZES[size],
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

export function Verified({ role }: { role?: string }) {
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
