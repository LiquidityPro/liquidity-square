"use client";

import { useEffect, useRef } from "react";
import { signOutSession } from "@/lib/session";
import { parseLiveUpdate, type LiveUpdate } from "./api";

type Handlers = {
  /** Read when an event arrives so a stale unread count can be ignored. */
  currentEpoch: () => number;
  onUpdate: (update: LiveUpdate, epochAtStart: number) => void;
};

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    const finish = () => {
      window.clearTimeout(timer);
      resolve();
    };
    if (signal.aborted) finish();
    else signal.addEventListener("abort", finish, { once: true });
  });
}

function untilVisible(signal: AbortSignal) {
  if (document.visibilityState === "visible") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const finish = () => {
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    const onChange = () => {
      if (signal.aborted || document.visibilityState === "visible") finish();
    };
    document.addEventListener("visibilitychange", onChange);
    if (signal.aborted) finish();
  });
}

async function readStream(
  token: string,
  since: string | null,
  signal: AbortSignal,
  onEvent: (update: LiveUpdate) => void,
) {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  const res = await fetch(`/api/server/live/stream${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    cache: "no-store",
    signal,
  });
  if (res.status === 401) {
    void signOutSession();
    return "auth" as const;
  }
  if (!res.ok || !res.body) throw new Error(`Live stream failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let cursor = since;

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const data = chunk
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      const update = parseLiveUpdate(JSON.parse(data));
      cursor = update.now;
      onEvent(update);
    }
  }

  return { cursor };
}

export function useLiveTracker(token: string | undefined, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) return;
    const lifetime = new AbortController();
    let since: string | null = null;
    let connection: AbortController | null = null;

    const run = async () => {
      let attempt = 0;
      while (!lifetime.signal.aborted) {
        await untilVisible(lifetime.signal);
        if (lifetime.signal.aborted) return;
        connection = new AbortController();
        const stopConnection = () => connection?.abort();
        if (document.visibilityState === "hidden") stopConnection();
        const onHide = () => {
          if (document.visibilityState === "hidden") stopConnection();
        };
        document.addEventListener("visibilitychange", onHide);
        try {
          const outcome = await readStream(token, since, connection.signal, (update) => {
            since = update.now;
            handlersRef.current.onUpdate(update, handlersRef.current.currentEpoch());
          });
          if (outcome === "auth" || lifetime.signal.aborted) return;
          attempt = 0;
        } catch (err) {
          if (lifetime.signal.aborted) return;
          if (!isAbort(err) && document.visibilityState === "visible") {
            console.error("Live stream failed", err);
            attempt += 1;
          }
        } finally {
          document.removeEventListener("visibilitychange", onHide);
        }
        if (lifetime.signal.aborted) return;
        if (document.visibilityState === "hidden") continue;
        await wait(Math.min(15_000, 500 * 2 ** Math.min(attempt, 5)), lifetime.signal);
      }
    };

    void run();
    return () => {
      lifetime.abort();
      connection?.abort();
    };
  }, [token]);
}
