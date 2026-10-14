"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, PageHeader, UserRow } from "./parts";
import { fetchConnections, fetchProfile } from "./api";
import { useSquare } from "./context";
import type { Author } from "./data";
import { cn } from "@/lib/utils";

export function PeoplePage({ kind }: { kind: "followers" | "following" }) {
  const { id } = useParams() as { id: string };
  const { token, ready } = useSquare();
  const [name, setName] = useState("Profile");
  const [people, setPeople] = useState<Author[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    setStatus("loading");
    Promise.all([fetchProfile(token, id), fetchConnections(token, id, kind)])
      .then(([profile, users]) => {
        if (cancelled) return;
        setName(profile.name);
        setPeople(users);
        setStatus("ready");
      })
      .catch((err: Error) => !cancelled && setStatus(/not found/i.test(err.message) ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [id, kind, token, ready]);

  if (status === "missing" || status === "error") {
    return (
      <>
        <PageHeader title="Profile" back />
        <EmptyState
          title={status === "missing" ? "This account doesn't exist" : "Couldn't load this list"}
          body={status === "missing" ? "Try searching for another trader." : "Check your connection and try again."}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title={name} back>
        <div role="tablist" aria-label="Connections" className="flex">
          <ConnectionTab href={`/square/u/${id}/followers`} active={kind === "followers"}>
            Followers
          </ConnectionTab>
          <ConnectionTab href={`/square/u/${id}/following`} active={kind === "following"}>
            Following
          </ConnectionTab>
        </div>
      </PageHeader>
      {status === "loading" ? (
        <div className="space-y-3 px-4 py-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="size-10 animate-pulse rounded-full bg-card" />
              <div className="h-4 w-40 animate-pulse rounded bg-card" />
            </div>
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          title={kind === "followers" ? "No followers yet" : "Not following anyone yet"}
          body={
            kind === "followers"
              ? "When people follow this account, they'll show up here."
              : "Accounts this profile follows will show up here."
          }
        />
      ) : (
        <ul>
          {people.map((person) => (
            <li key={person.id ?? person.handle}>
              <UserRow author={person} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ConnectionTab({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "relative grid min-h-12 flex-1 place-items-center text-sm transition-colors hover:bg-card",
        active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
      )}
    >
      {children}
      {active && <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />}
    </Link>
  );
}
