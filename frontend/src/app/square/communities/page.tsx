"use client";

import Link from "next/link";
import { PageHeader } from "@/components/square/parts";
import { compact } from "@/components/square/data";
import { useLocalSet } from "@/components/square/use-local-set";
import { COMMUNITIES } from "@/components/square/x-samples";

export default function CommunitiesPage() {
  const joined = useLocalSet("square:communities");

  return (
    <>
      <PageHeader title="Communities" subtitle="Desks you can join" />
      <ul>
        {COMMUNITIES.map((community) => {
          const on = joined.has(community.slug);
          return (
            <li key={community.slug} className="border-b">
              <div className="flex items-start gap-3 px-4 py-4">
                <Link href={`/square/communities/${community.slug}`} className="min-w-0 flex-1 hover:opacity-90">
                  <p className="label-mono text-primary">{community.topic}</p>
                  <p className="mt-1 text-lg font-bold">{community.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {compact(community.members + (on ? 1 : 0))} members
                  </p>
                </Link>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => joined.toggle(community.slug)}
                  className="min-h-9 shrink-0 rounded-full border px-4 text-sm font-bold transition hover:bg-card"
                >
                  {on ? "Joined" : "Join"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
