"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, TabBar } from "@/components/square/parts";
import { UserRow } from "@/components/square/user-row";
import { useSquare } from "@/components/square/context";
import { fetchBlocked, fetchMuted, setBlocked, setMuted } from "@/components/square/api";
import type { Author } from "@/components/square/data";

type Tab = "muted" | "blocked";

export default function SafetyPage() {
  const { token, ready } = useSquare();
  const [tab, setTab] = useState<Tab>("muted");
  const [muted, setMutedList] = useState<Author[]>([]);
  const [blocked, setBlockedList] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchMuted(token), fetchBlocked(token)])
      .then(([mutedRows, blockedRows]) => {
        if (cancelled) return;
        setMutedList(mutedRows);
        setBlockedList(blockedRows);
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, ready]);

  const rows = tab === "muted" ? muted : blocked;

  async function lift(author: Author) {
    if (!token || !author.id) return;
    try {
      if (tab === "muted") {
        await setMuted(token, author.id, false);
        setMutedList((current) => current.filter((row) => row.id !== author.id));
      } else {
        await setBlocked(token, author.id, false);
        setBlockedList((current) => current.filter((row) => row.id !== author.id));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update this account");
    }
  }

  return (
    <>
      <PageHeader title="Muted and blocked" back>
        <TabBar
          tabs={[
            { id: "muted" as const, label: "Muted" },
            { id: "blocked" as const, label: "Blocked" },
          ]}
          value={tab}
          onChange={setTab}
          label="Safety lists"
        />
      </PageHeader>
      {loading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === "muted" ? "You haven't muted anyone" : "You haven't blocked anyone"}
          body={tab === "muted" ? "Muted accounts disappear from your feeds." : "Blocked accounts can't see you, and you can't see them."}
        />
      ) : (
        <ul>
          {rows.map((author) => (
            <li key={author.id ?? author.handle} className="flex items-center">
              <div className="min-w-0 flex-1">
                <UserRow author={author} />
              </div>
              <button type="button" onClick={() => void lift(author)} className="mr-4 text-sm font-semibold text-primary">
                {tab === "muted" ? "Unmute" : "Unblock"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
