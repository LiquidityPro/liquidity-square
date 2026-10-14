"use client";

import Link from "next/link";
import { LuLock as Lock, LuRadio as Radio } from "react-icons/lu";
import { Avatar, PageHeader } from "@/components/square/parts";
import { PRO_ROOMS, type ProRoom } from "@/components/square/x-samples";
import { cn } from "@/lib/utils";

export default function RoomsPage() {
  const featured = PRO_ROOMS.find((room) => room.sampleOpen) ?? PRO_ROOMS[0];
  const rest = PRO_ROOMS.filter((room) => room.slug !== featured.slug);

  return (
    <>
      <PageHeader title="Pro rooms" subtitle="Analyst rooms on the floor" />
      <Link
        href={`/square/rooms/${featured.slug}`}
        className="block border-b bg-paper px-4 py-5 text-paper-foreground transition hover:opacity-95"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="label-mono inline-flex items-center gap-1.5">
            <Radio className="size-3.5" aria-hidden="true" />
            Sample room · open
          </span>
          <span className="label-mono">{featured.listeners} listening</span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold leading-tight">{featured.title}</h2>
        <p className="mt-2 text-sm opacity-80">{featured.summary}</p>
        <p className="mt-3 font-mono text-xs opacity-70">Hosted by {featured.host.name}</p>
      </Link>
      <ul>
        {rest.map((room) => (
          <li key={room.slug}>
            <RoomRow room={room} />
          </li>
        ))}
      </ul>
    </>
  );
}

function RoomRow({ room }: { room: ProRoom }) {
  return (
    <Link href={`/square/rooms/${room.slug}`} className="flex gap-3 border-b px-4 py-4 transition-colors hover:bg-card/60">
      <Avatar author={room.host} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Status status={room.status} />
          <span className="font-mono text-xs text-muted-foreground">{room.when}</span>
        </div>
        <p className="mt-1 font-semibold leading-snug">{room.title}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{room.summary}</p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {room.host.name} · {room.listeners} listening
        </p>
      </div>
      {!room.sampleOpen && <Lock className="mt-1 size-4 shrink-0 text-muted-foreground" aria-label="Preview locked" />}
    </Link>
  );
}

function Status({ status }: { status: ProRoom["status"] }) {
  const live = status === "live";
  return (
    <span
      className={cn(
        "label-mono rounded px-1.5 py-0.5",
        live ? "bg-primary/15 text-primary" : "bg-card text-muted-foreground",
      )}
    >
      {live ? "Live" : status === "scheduled" ? "Scheduled" : "Replay"}
    </span>
  );
}
