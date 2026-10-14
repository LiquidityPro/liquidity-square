"use client";

import { useParams } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/square/parts";
import { NoteRow } from "@/components/square/note-row";
import { compact } from "@/components/square/data";
import { useLocalSet } from "@/components/square/use-local-set";
import { communityBySlug } from "@/components/square/x-samples";

export default function CommunityPage() {
  const { slug } = useParams() as { slug: string };
  const community = communityBySlug(slug);
  const joined = useLocalSet("square:communities");

  if (!community) {
    return (
      <>
        <PageHeader title="Community" back />
        <EmptyState title="This community doesn't exist" body="Browse the directory and join another desk." />
      </>
    );
  }

  const on = joined.has(community.slug);

  return (
    <>
      <PageHeader
        title={community.name}
        subtitle={community.topic}
        back
        action={
          <button
            type="button"
            aria-pressed={on}
            onClick={() => joined.toggle(community.slug)}
            className="min-h-9 rounded-full bg-foreground px-4 text-sm font-bold text-background"
          >
            {on ? "Joined" : "Join"}
          </button>
        }
      />
      <section className="border-b px-4 py-4">
        <p className="text-[15px]">{community.description}</p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">{compact(community.members + (on ? 1 : 0))} members</p>
      </section>
      {community.posts.map((post) => (
        <NoteRow key={post.id} author={post.author} time={post.time} body={post.body} />
      ))}
    </>
  );
}
