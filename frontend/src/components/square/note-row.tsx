"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import type { Author } from "./data";

export function TickerText({ text, linkClassName }: { text: string; linkClassName?: string }) {
  const parts = text.split(/(\$[A-Z]{2,12}|@[A-Za-z0-9_]{1,30})/g);
  const linkClass = cn("hover:underline", linkClassName ?? "text-primary");
  return (
    <>
      {parts.map((part, index) => {
        if (/^\$[A-Z]{2,12}$/.test(part)) {
          return (
            <Link
              key={index}
              href={`/square/${part.slice(1)}`}
              onClick={(event) => event.stopPropagation()}
              className={cn("font-mono", linkClass)}
            >
              {part}
            </Link>
          );
        }
        if (/^@[A-Za-z0-9_]{1,30}$/.test(part)) {
          return (
            <Link
              key={index}
              href={`/square/u/${part.slice(1).toLowerCase()}`}
              onClick={(event) => event.stopPropagation()}
              className={linkClass}
            >
              {part}
            </Link>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export function NoteRow({ author, time, body }: { author: Author; time: string; body: string }) {
  return (
    <article className="flex gap-3 border-b px-4 py-3">
      <Avatar author={author} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 text-sm">
          <span className="truncate font-semibold">{author.name}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            @{author.handle} · {time}
          </span>
        </p>
        <p className="mt-1 whitespace-pre-wrap text-[0.95rem] leading-snug">
          <TickerText text={body} />
        </p>
      </div>
    </article>
  );
}
