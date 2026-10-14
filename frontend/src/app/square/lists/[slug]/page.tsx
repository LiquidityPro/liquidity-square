"use client";

import { useParams } from "next/navigation";
import { EmptyState, PageHeader, UserRow } from "@/components/square/parts";
import { compact } from "@/components/square/data";
import { useLocalSet } from "@/components/square/use-local-set";
import { listBySlug } from "@/components/square/x-samples";

export default function ListDetailPage() {
  const { slug } = useParams() as { slug: string };
  const list = listBySlug(slug);
  const followed = useLocalSet("square:lists-followed");

  if (!list) {
    return (
      <>
        <PageHeader title="List" back />
        <EmptyState title="This list doesn't exist" body="Pick another list from the directory." />
      </>
    );
  }

  const on = list.mine || followed.has(list.slug);

  return (
    <>
      <PageHeader
        title={list.name}
        subtitle={`${list.members.length} members`}
        back
        action={
          list.mine ? null : (
            <button
              type="button"
              aria-pressed={on}
              onClick={() => followed.toggle(list.slug)}
              className="min-h-9 rounded-full border px-4 text-sm font-bold transition hover:bg-card"
            >
              {on ? "Following" : "Follow"}
            </button>
          )
        }
      />
      <section className="border-b px-4 py-4">
        <p className="text-[15px]">{list.description}</p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {list.mine ? "Your list" : `By ${list.owner.name}`} · {compact(list.followers + (on && !list.mine ? 1 : 0))} followers
        </p>
      </section>
      <ul>
        {list.members.map((member) => (
          <li key={member.handle}>
            <UserRow author={member} />
          </li>
        ))}
      </ul>
    </>
  );
}
