"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LuSearch as Search } from "react-icons/lu";
import { Avatar, EmptyState, PageHeader } from "@/components/square/parts";
import { relativeTime } from "@/components/square/api";
import { lastMessage, useInbox } from "@/components/square/use-inbox";

export default function MessagesPage() {
  const { threads, status } = useInbox();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => {
      const last = lastMessage(thread);
      return (
        thread.with.name.toLowerCase().includes(needle) ||
        thread.with.handle.toLowerCase().includes(needle) ||
        (last?.body.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [q, threads]);

  return (
    <>
      <PageHeader title="Messages" />
      <div className="border-b px-4 py-3">
        <label htmlFor="message-search" className="sr-only">
          Search messages
        </label>
        <div className="flex items-center gap-3 rounded-full border bg-card px-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            id="message-search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search Direct Messages"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      {status === "error" ? (
        <EmptyState title="Couldn't load messages" body="Check your connection and try again." />
      ) : status === "loading" ? (
        <div className="space-y-px" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex gap-3 border-b px-4 py-3">
              <div className="size-10 animate-pulse rounded-full bg-card" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-32 animate-pulse rounded bg-card" />
                <div className="h-3 w-48 animate-pulse rounded bg-card" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={q ? "No conversations" : "No messages yet"}
          body={q ? "Try another name." : "Message someone from their profile."}
        />
      ) : (
        <ul>
          {filtered.map((thread) => {
            const last = lastMessage(thread);
            return (
              <li key={thread.id}>
                <Link
                  href={`/square/messages/${thread.id}`}
                  className="flex gap-3 border-b px-4 py-3 transition-colors hover:bg-card/60"
                >
                  <Avatar author={thread.with} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className={`truncate ${thread.unread ? "font-bold" : "font-semibold"}`}>{thread.with.name}</p>
                      <p className="shrink-0 font-mono text-xs text-muted-foreground">
                        @{thread.with.handle}
                        {last ? ` · ${relativeTime(last.createdAt)}` : ""}
                      </p>
                    </div>
                    <p className={`mt-0.5 truncate text-sm ${thread.unread ? "text-foreground" : "text-muted-foreground"}`}>
                      {last?.mine ? "You: " : ""}
                      {last?.body}
                    </p>
                  </div>
                  {thread.unread && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
