"use client";

import { forwardRef, useState } from "react";
import { ChartColumn, TrendingDown, TrendingUp } from "lucide-react";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";
import { ME, type Stance } from "./data";

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
