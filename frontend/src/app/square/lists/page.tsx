"use client";

import Link from "next/link";
import { Avatar, PageHeader } from "@/components/square/parts";
import { LISTS, type SquareList } from "@/components/square/x-samples";
import { compact } from "@/components/square/data";

export default function ListsPage() {
  const mine = LISTS.filter((list) => list.mine);
  const discover = LISTS.filter((list) => !list.mine);

  return (
    <>
      <PageHeader title="Lists" subtitle="Curated voices" />
      <Section title="Your lists" lists={mine} />
      <Section title="Discover" lists={discover} />
    </>
  );
}

function Section({ title, lists }: { title: string; lists: SquareList[] }) {
  if (lists.length === 0) return null;
  return (
    <section>
      <h2 className="border-b px-4 py-3 text-xl font-bold">{title}</h2>
      <ul>
        {lists.map((list) => (
          <li key={list.slug}>
            <Link href={`/square/lists/${list.slug}`} className="block border-b px-4 py-4 transition-colors hover:bg-card/60">
              <div className="flex items-center gap-2">
                <Avatar author={list.owner} size="sm" />
                <p className="min-w-0 truncate text-sm text-muted-foreground">
                  {list.mine ? "You" : list.owner.name} · {compact(list.followers)} followers
                </p>
              </div>
              <p className="mt-2 text-lg font-bold">{list.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{list.members.length} members</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
