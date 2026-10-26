"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSquare } from "./context";
import { useCurrentAuthor } from "./use-current-author";

const STORAGE_PREFIX = "lq-square-tour-v2";
export const SQUARE_TOUR_IDLE = "lq-square-tour-idle";
const REPLAY_KEY = "lq-square-tour-replay";
const MARGIN = 16;
const GAP = 12;

type Prefer = "auto" | "above" | "below" | "left" | "right";

type Step = {
  id: string;
  title: string;
  body: string;
  targets?: string[];
  prefer?: Prefer;
  /** Spotlight lives on the home feed, so go there before measuring. */
  needsHome?: boolean;
};

type Box = { top: number; left: number; width: number; height: number; radius: number };
type Point = { top: number; left: number };

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function tourSeen(userId: string) {
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return true;
  }
}

function markTourSeen(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* private mode */
  }
}

export function requestSquareTour() {
  try {
    sessionStorage.setItem(REPLAY_KEY, "1");
  } catch {
    /* private mode */
  }
}

function replayRequested() {
  const query = new URLSearchParams(window.location.search).get("tour") === "1";
  try {
    return query || sessionStorage.getItem(REPLAY_KEY) === "1";
  } catch {
    return query;
  }
}

function clearReplayRequest() {
  try {
    sessionStorage.removeItem(REPLAY_KEY);
  } catch {
    /* private mode */
  }
  const url = new URL(window.location.href);
  if (!url.searchParams.has("tour")) return;
  url.searchParams.delete("tour");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

function buildSteps(): Step[] {
  const desktop = window.matchMedia("(min-width: 640px)").matches;
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  const steps: Step[] = [
    {
      id: "welcome",
      title: "Welcome to The Square",
      body: "The floor for Nigerian market conversation. Prices, filings, and theses live in one place. This is a short walk through.",
    },
    {
      id: "tape",
      title: "The NGX tape",
      body: desktop
        ? "Prices for the session run across the top. Green is up on the day, red is down."
        : "Prices for the session run across the top. Tap the tape anytime to open trending names and people to follow.",
      targets: ["tape"],
      prefer: "below",
    },
    {
      id: "composer",
      title: "Share a thesis",
      body: desktop
        ? "Write what's moving. Tag a ticker with $DANGCEM, mention someone with @, and mark it bullish or bearish."
        : "Write what's moving. Tag a ticker with $DANGCEM, mention someone with @, and mark it bullish or bearish. After you scroll, the feather button brings the composer back.",
      targets: ["composer"],
      prefer: "below",
      needsHome: true,
    },
    {
      id: "feed",
      title: "Four ways to read the floor",
      body: "For you is everyone. Following is people you chose. Watchlist is the names you track. Verified is analysts and institutions.",
      targets: ["feed"],
      prefer: "below",
      needsHome: true,
    },
    {
      id: "week",
      title: "This week on NGX",
      body: "New filings show up under the composer. Open the name and read the filing before you weigh in.",
      targets: ["week"],
      prefer: "below",
      needsHome: true,
    },
  ];

  if (desktop) {
    steps.push({
      id: "nav",
      title: "Find your way",
      body: "Home, Explore, notifications, messages, bookmarks, and your profile. More holds drafts, lists, and settings. Post starts a note from any page.",
      targets: ["nav"],
      prefer: "right",
    });
  } else {
    steps.push(
      {
        id: "nav",
        title: "The bottom bar",
        body: "Home, Explore, notifications, bookmarks, messages, and your profile stay one tap away.",
        targets: ["mobile-nav"],
        prefer: "above",
      },
      {
        id: "menu",
        title: "Your menu",
        body: "Drafts, lists, communities, pro rooms, and settings live here.",
        targets: ["menu"],
        prefer: "below",
      },
    );
  }

  if (wide) {
    steps.push({
      id: "rail",
      title: "Markets beside the feed",
      body: "Search a ticker, see what's trending, and follow people without leaving the floor.",
      targets: ["rail"],
      prefer: "left",
    });
  }

  return steps;
}

function findVisible(names: string[]) {
  for (const name of names) {
    for (const node of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      return node;
    }
  }
  return null;
}

function pinned(node: HTMLElement) {
  const position = getComputedStyle(node).position;
  return position === "fixed" || position === "sticky";
}

function inView(rect: DOMRect) {
  if (rect.height >= window.innerHeight - 32) return rect.top >= -8 && rect.top < 96;
  return rect.top >= 8 && rect.bottom <= window.innerHeight - 8 && rect.left >= 0 && rect.right <= window.innerWidth;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function padded(rect: DOMRect): Box {
  const fullBleed = rect.left <= 8 && rect.right >= window.innerWidth - 8;
  const x = fullBleed ? 0 : 8;
  const y = 8;
  const left = Math.max(8, rect.left - x);
  const top = Math.max(8, rect.top - y);
  const right = Math.min(window.innerWidth - 8, rect.right + x);
  const bottom = Math.min(window.innerHeight - 8, rect.bottom + y);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const square = Math.abs(rect.width - rect.height) < 8 && rect.width < 80;
  const radius = fullBleed ? 12 : square ? 999 : 16;
  return { top, left, width, height, radius };
}

function centerOf(width: number, height: number): Point {
  return {
    top: clamp((window.innerHeight - height) / 2, MARGIN, window.innerHeight - height - MARGIN),
    left: clamp((window.innerWidth - width) / 2, MARGIN, window.innerWidth - width - MARGIN),
  };
}

function placeCard(rect: Box, width: number, height: number, prefer: Prefer): Point {
  const space = {
    below: window.innerHeight - (rect.top + rect.height),
    above: rect.top,
    right: window.innerWidth - (rect.left + rect.width),
    left: rect.left,
  };
  const order: Prefer[] = prefer === "auto" ? ["below", "above", "right", "left"] : [prefer, "below", "above", "right", "left"];
  const alignX = () => clamp(rect.left + rect.width / 2 - width / 2, MARGIN, window.innerWidth - width - MARGIN);
  const alignY = () => clamp(rect.top + rect.height / 2 - height / 2, MARGIN, window.innerHeight - height - MARGIN);

  for (const side of order) {
    if (side === "below" && space.below >= height + GAP + MARGIN) return { top: rect.top + rect.height + GAP, left: alignX() };
    if (side === "above" && space.above >= height + GAP + MARGIN) return { top: rect.top - GAP - height, left: alignX() };
    if (side === "right" && space.right >= width + GAP + MARGIN) return { top: alignY(), left: rect.left + rect.width + GAP };
    if (side === "left" && space.left >= width + GAP + MARGIN) return { top: alignY(), left: rect.left - GAP - width };
  }
  return centerOf(width, height);
}

function sameBox(a: Box | null, b: Box | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

function samePoint(a: Point | null, b: Point | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1;
}

export function SquareTour({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = useSquare();
  const me = useCurrentAuthor();
  const userId = token ? me.id : undefined;
  const [phase, setPhase] = useState<"closed" | "open">("closed");
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [cardPos, setCardPos] = useState<Point | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const pending = useRef(false);
  const routerRef = useRef(router);
  const userIdRef = useRef(userId);
  const indexRef = useRef(index);
  const stepsRef = useRef(steps);
  routerRef.current = router;
  userIdRef.current = userId;
  indexRef.current = index;
  stepsRef.current = steps;

  const finish = () => {
    const id = userIdRef.current;
    if (id) markTourSeen(id);
    clearReplayRequest();
    pending.current = false;
    opened.current = false;
    setPhase("closed");
    setSpot(null);
    setCardPos(null);
    queueMicrotask(() => window.dispatchEvent(new Event(SQUARE_TOUR_IDLE)));
  };

  const next = () => {
    if (indexRef.current >= stepsRef.current.length - 1) {
      finish();
      return;
    }
    setIndex(indexRef.current + 1);
  };

  const back = () => setIndex((current) => Math.max(0, current - 1));

  const actions = useRef({ next, back, finish });
  actions.current = { next, back, finish };

  useEffect(() => {
    if (!ready || !userId || pending.current) return;
    const replay = replayRequested();
    if (!replay && tourSeen(userId)) {
      queueMicrotask(() => window.dispatchEvent(new Event(SQUARE_TOUR_IDLE)));
      return;
    }
    pending.current = true;
    const timer = window.setTimeout(() => {
      opened.current = true;
      clearReplayRequest();
      setSteps(buildSteps());
      setIndex(0);
      setSpot(null);
      setCardPos(null);
      setPhase("open");
    }, 450);
    return () => {
      window.clearTimeout(timer);
      if (!opened.current) pending.current = false;
    };
  }, [ready, userId, pathname]);

  useEffect(() => {
    if (phase !== "open") return;
    const shell = document.getElementById("square-shell");
    shell?.setAttribute("inert", "");
    const block = (event: Event) => event.preventDefault();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        actions.current.finish();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        actions.current.next();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        actions.current.back();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const items = [...cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !cardRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    window.addEventListener("keydown", onKey);
    cardRef.current?.focus({ preventScroll: true });
    return () => {
      shell?.removeAttribute("inert");
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, index]);

  useEffect(() => {
    if (phase !== "open") return;
    const step = steps[index];
    if (!step) return;
    let stopped = false;
    let askedForHome = false;
    let scrolled = false;
    const spotRef = { current: null as Box | null };
    const posRef = { current: null as Point | null };

    const commit = (nextSpot: Box | null, nextPos: Point) => {
      if (!sameBox(spotRef.current, nextSpot)) {
        spotRef.current = nextSpot;
        setSpot(nextSpot);
      }
      if (!samePoint(posRef.current, nextPos)) {
        posRef.current = nextPos;
        setCardPos(nextPos);
      }
    };

    const measure = () => {
      if (stopped) return;
      const card = cardRef.current;
      const width = card?.offsetWidth || Math.min(352, window.innerWidth - MARGIN * 2);
      const height = card?.offsetHeight || 220;

      if (step.needsHome && window.location.pathname !== "/square") {
        if (!askedForHome) {
          askedForHome = true;
          routerRef.current.push("/square");
        }
        commit(null, centerOf(width, height));
        return;
      }

      const target = step.targets ? findVisible(step.targets) : null;
      if (!target) {
        commit(null, centerOf(width, height));
        return;
      }

      if (!scrolled && !pinned(target)) {
        const rect = target.getBoundingClientRect();
        if (!inView(rect)) {
          scrolled = true;
          target.scrollIntoView({ block: "center", inline: "nearest" });
        }
      }

      const box = padded(target.getBoundingClientRect());
      commit(box, placeCard(box, width, height, step.prefer ?? "auto"));
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const interval = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("resize", measure);
    };
  }, [phase, index, steps]);

  if (phase !== "open" || steps.length === 0) return null;
  const step = steps[index];
  if (!step) return null;
  const last = index === steps.length - 1;

  return (
    <>
      <div className="fixed inset-0 z-[90]" aria-hidden="true">
        {spot ? (
          <div
            className="pointer-events-none absolute"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              borderRadius: spot.radius,
              boxShadow: "0 0 0 2px var(--primary), 0 0 0 9999px rgb(0 0 0 / 0.72)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-black/72" />
        )}
      </div>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="square-tour-title"
        aria-describedby="square-tour-body"
        tabIndex={-1}
        className="fixed z-[100] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border bg-card p-5 text-card-foreground shadow-2xl outline-none"
        style={{
          top: cardPos?.top ?? MARGIN,
          left: cardPos?.left ?? MARGIN,
          visibility: cardPos ? "visible" : "hidden",
        }}
      >
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-primary">
          {index + 1} of {steps.length}
        </p>
        <h2 id="square-tour-title" className="mt-1 text-lg font-bold">
          {step.title}
        </h2>
        <p id="square-tour-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {steps.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cn("h-1.5 rounded-full transition-[width,background-color]", itemIndex === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30")}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          {last ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={finish}
              className="min-h-11 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Skip
            </button>
          )}
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="min-h-11 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
