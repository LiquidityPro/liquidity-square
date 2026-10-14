"use client";

import { useEffect, useRef } from "react";
import { fetchLive, type LiveUpdate } from "./api";

const LIVE_MS = 4_000;

type Handlers = {
  /** Read when a poll starts so a stale unread count can be ignored. */
  currentEpoch: () => number;
  onUpdate: (update: LiveUpdate, epochAtStart: number) => void;
};

export function useLiveTracker(token: string | undefined, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    let since: string | null = null;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      const epochAtStart = handlersRef.current.currentEpoch();
      try {
        const update = await fetchLive(token, since);
        if (cancelled) return;
        since = update.now;
        handlersRef.current.onUpdate(update, epochAtStart);
      } catch (err) {
        console.error("Live update failed", err);
      } finally {
        inFlight = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };

    void tick();
    const interval = window.setInterval(() => void tick(), LIVE_MS);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);
}
