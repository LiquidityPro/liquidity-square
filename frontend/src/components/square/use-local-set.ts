"use client";

import { useEffect, useState } from "react";

export function useLocalSet(key: string) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setIds(parsed.filter((id): id is string => typeof id === "string"));
    } catch {
      /* ignore broken local data */
    }
  }, [key]);

  function toggle(id: string) {
    setIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  return { has: (id: string) => ids.includes(id), toggle };
}
