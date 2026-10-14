"use client";

import { useEffect, useState } from "react";
import type { TapeSnapshot } from "@/lib/market/tape";

const MIN_WAIT_MS = 5_000;
const RETRY_MS = 60_000;

type Store = {
  snapshot: TapeSnapshot | null;
  failed: boolean;
};

let store: Store = { snapshot: null, failed: false };
let refreshAt = Number.POSITIVE_INFINITY;
let timer = 0;
let pending = false;
let listening = false;
const listeners = new Set<(store: Store) => void>();

function emit() {
  for (const listener of listeners) listener(store);
}

function onVisible() {
  if (document.visibilityState === "visible" && Date.now() >= refreshAt) void load();
}

async function load() {
  if (pending) return;
  pending = true;
  window.clearTimeout(timer);
  try {
    const res = await fetch("/api/market/tape", { cache: "no-store" });
    if (!res.ok) throw new Error(`Tape request failed (${res.status})`);
    const snapshot = (await res.json()) as TapeSnapshot;
    store = { snapshot, failed: false };
    refreshAt = new Date(snapshot.refreshAt).getTime();
    timer = window.setTimeout(load, Math.max(MIN_WAIT_MS, refreshAt - Date.now()));
  } catch {
    store = { snapshot: store.snapshot, failed: true };
    refreshAt = Date.now() + RETRY_MS;
    timer = window.setTimeout(load, RETRY_MS);
  } finally {
    pending = false;
    emit();
    if (listeners.size === 0) window.clearTimeout(timer);
  }
}

function ensure() {
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", onVisible);
  }
  if (!store.snapshot || Date.now() >= refreshAt) void load();
}

export function useMarketTape() {
  const [state, setState] = useState(store);

  useEffect(() => {
    listeners.add(setState);
    ensure();
    setState(store);
    return () => {
      listeners.delete(setState);
      if (listeners.size === 0) window.clearTimeout(timer);
    };
  }, []);

  return state;
}
