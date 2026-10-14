"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchInbox, type InboxThread } from "./api";
import { useSquare } from "./context";

export function useInbox() {
  const { token, ready, incomingMessages } = useSquare();
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const reload = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetchInbox(token)
      .then((next) => {
        setThreads(next);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setThreads([]);
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetchInbox(token)
      .then((next) => {
        if (cancelled) return;
        setThreads(next);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  const latestIncoming = incomingMessages[incomingMessages.length - 1]?.id;
  useEffect(() => {
    if (!latestIncoming || !token) return;
    void reload();
  }, [latestIncoming, token, reload]);

  return { threads, status, reload };
}

export function lastMessage(thread: InboxThread) {
  return thread.lastMessage;
}
