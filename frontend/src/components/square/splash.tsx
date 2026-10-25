"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/site";
import { cn } from "@/lib/utils";
import { useSquare } from "./context";

const HOLD_MS = 1100;
const LEAVE_MS = 680;

/* Full-screen boot mark. Fades in, rests, then the floor shows through. */
export function SquareSplash() {
  const { ready } = useSquare();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  useEffect(() => {
    if (!ready || leaving) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = mountedAt.current ?? performance.now();
    const wait = Math.max(0, (reduce ? 180 : HOLD_MS) - (performance.now() - started));
    const timer = window.setTimeout(() => setLeaving(true), wait);
    return () => window.clearTimeout(timer);
  }, [ready, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setVisible(false), reduce ? 0 : LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading The Square"
      className={cn(
        "fixed inset-0 z-[80] grid place-items-center bg-background transition-opacity ease-out motion-reduce:transition-none",
        leaving ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${LEAVE_MS}ms` }}
    >
      <div className="splash-mark size-24">
        <Logo mark priority className="size-full" />
      </div>
    </div>
  );
}
