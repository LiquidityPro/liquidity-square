"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LuLock as Lock, LuRadio as Radio } from "react-icons/lu";
import { Avatar, EmptyState, PageHeader } from "@/components/square/parts";
import { NoteRow, TickerText } from "@/components/square/note-row";
import { useCurrentAuthor } from "@/components/square/use-current-author";
import { useLocalSet } from "@/components/square/use-local-set";
import { roomBySlug, type SampleNote } from "@/components/square/x-samples";

const NOTES_KEY = "square:room-notes";

export default function RoomPage() {
  const { slug } = useParams() as { slug: string };
  const room = roomBySlug(slug);
  const me = useCurrentAuthor();
  const joined = useLocalSet("square:room-preview");
  const open = !!room && (room.sampleOpen || joined.has(room.slug));
  const [extra, setExtra] = useState<SampleNote[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!room) return;
    try {
      const raw = localStorage.getItem(`${NOTES_KEY}:${room.slug}`);
      if (!raw) {
        setExtra([]);
        return;
      }
      const parsed = JSON.parse(raw) as SampleNote[];
      setExtra(Array.isArray(parsed) ? parsed : []);
    } catch {
      setExtra([]);
    }
  }, [room]);

  if (!room) {
    return (
      <>
        <PageHeader title="Pro room" back />
        <EmptyState title="This room doesn't exist" body="Head back to the room list and pick another desk." />
      </>
    );
  }

  function publishNote() {
    const body = draft.trim();
    if (!body || !room) return;
    const note: SampleNote = {
      id: `local-${Date.now()}`,
      author: me,
      time: "now",
      body: body.slice(0, 280),
    };
    const next = [...extra, note];
    setExtra(next);
    setDraft("");
    try {
      localStorage.setItem(`${NOTES_KEY}:${room.slug}`, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }

  const notes = [...room.notes, ...extra];

  return (
    <>
      <PageHeader title={room.title} subtitle={room.host.name} back />
      <section className="border-b px-4 py-4">
        <div className="flex items-start gap-3">
          <Avatar author={room.host} />
          <div className="min-w-0 flex-1">
            <p className="label-mono inline-flex items-center gap-1.5 text-primary">
              <Radio className="size-3.5" aria-hidden="true" />
              {room.sampleOpen ? "Sample room" : room.when}
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug">{room.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <TickerText text={room.summary} />
            </p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {room.listeners} listening · {room.tickers.map((ticker) => `$${ticker}`).join(" ")}
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-card px-3 py-2 text-sm text-muted-foreground">
          This is a sample desk. Notes you add stay on this device and are not posted to the floor.
        </p>
      </section>

      {open ? (
        <>
          <div>
            {notes.map((note) => (
              <NoteRow key={note.id} author={note.author} time={note.time} body={note.body} />
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              publishNote();
            }}
            className="sticky bottom-16 border-t bg-background px-4 py-3 sm:bottom-0"
          >
            <label htmlFor="room-note" className="sr-only">
              Add a note
            </label>
            <textarea
              id="room-note"
              value={draft}
              maxLength={280}
              rows={2}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Add a note to this sample room"
              className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{draft.length}/280</span>
              <button
                type="submit"
                disabled={!draft.trim()}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Note
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="relative">
          <div className="pointer-events-none select-none blur-[6px]" aria-hidden="true">
            {room.notes.map((note) => (
              <NoteRow key={note.id} author={note.author} time={note.time} body={note.body} />
            ))}
          </div>
          <div className="absolute inset-0 grid place-items-center px-6">
            <div className="w-full max-w-sm rounded-2xl border bg-background/95 p-5 text-center shadow-lg">
              <Lock className="mx-auto size-5 text-primary" aria-hidden="true" />
              <p className="mt-2 font-display text-xl font-bold">Preview this room</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sample access on this device. Nothing is billed.
              </p>
              <button
                type="button"
                onClick={() => joined.toggle(room.slug)}
                className="mt-4 min-h-10 rounded-full bg-foreground px-5 text-sm font-bold text-background"
              >
                Open preview
              </button>
              <Link href="/square/rooms" className="mt-3 block text-sm text-muted-foreground hover:underline">
                All rooms
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
