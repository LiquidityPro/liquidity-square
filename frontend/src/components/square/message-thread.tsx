"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState, PageHeader } from "./parts";
import { TickerText } from "./note-row";
import { cn } from "@/lib/utils";
import { useSquare } from "./context";
import { useCurrentAuthor } from "./use-current-author";
import {
  fetchProfile,
  fetchThread,
  fetchThreadWith,
  markConversationRead,
  relativeTime,
  sendChatMessage,
  startConversation,
  type ChatMessage,
} from "./api";
import type { Author } from "./data";

const LIMIT = 1000;
/** Fills the column under the tape, and clears the mobile bar. */
const threadFrame = "flex min-h-[calc(100dvh-6.5rem)] flex-col sm:min-h-[calc(100dvh-2.5rem)]";

function Bubble({ message }: { message: ChatMessage }) {
  return (
    <div className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-[15px] leading-snug",
          message.mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card",
          message.pending && "opacity-70",
          message.failed && "opacity-100 ring-1 ring-bear",
        )}
      >
        <p className="whitespace-pre-wrap break-words">
          <TickerText text={message.body} linkClassName={message.mine ? "text-inherit" : undefined} />
        </p>
        <p
          className={cn(
            "mt-1 font-mono text-[0.65rem]",
            message.mine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {message.failed ? "Not sent" : message.pending ? "Sending" : relativeTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function Composer({
  handle,
  disabled,
  onSend,
}: {
  handle: string;
  disabled?: boolean;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const left = LIMIT - draft.length;
  const canSend = draft.trim().length > 0 && left >= 0 && !disabled;

  function submit() {
    if (!canSend) return;
    const text = draft;
    setDraft("");
    if (field.current) field.current.style.height = "auto";
    onSend(text);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="sticky bottom-16 z-30 border-t bg-background px-4 py-3 sm:bottom-0"
    >
      <label htmlFor="dm-draft" className="sr-only">
        Message @{handle}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="dm-draft"
          ref={field}
          value={draft}
          maxLength={LIMIT}
          rows={1}
          onChange={(event) => {
            setDraft(event.target.value);
            const node = event.target;
            node.style.height = "auto";
            node.style.height = `${node.scrollHeight}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Start a new message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border bg-card px-4 py-3 text-[15px] outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="mb-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  );
}

export function ConversationView({ conversationId }: { conversationId: string }) {
  const { token, ready, incomingMessages, setUnreadMessages } = useSquare();
  const [peer, setPeer] = useState<Author | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    setStatus("loading");
    fetchThread(token, conversationId)
      .then((page) => {
        if (cancelled) return;
        setPeer(page.with);
        setMessages(page.messages);
        setCursor(page.nextCursor);
        setStatus("ready");
        stick.current = true;
      })
      .catch((err: Error) => !cancelled && setStatus(/not found/i.test(err.message) ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [ready, token, conversationId]);

  useEffect(() => {
    if (!token || status !== "ready") return;
    markConversationRead(token, conversationId)
      .then(setUnreadMessages)
      .catch(() => undefined);
  }, [token, conversationId, status, messages.length, setUnreadMessages]);

  useEffect(() => {
    const fresh = incomingMessages.filter((item) => item.conversationId === conversationId);
    if (fresh.length === 0) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((item) => item.id));
      const add = fresh.filter((item) => !ids.has(item.id));
      if (add.length === 0) return prev;
      const pendingGone = prev.filter(
        (item) => !(item.pending && item.mine && add.some((next) => next.mine && next.body === item.body)),
      );
      return [...pendingGone, ...add.filter((item) => !pendingGone.some((kept) => kept.id === item.id))];
    });
  }, [incomingMessages, conversationId]);

  useEffect(() => {
    const onScroll = () => {
      const distance = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      stick.current = distance < 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (status !== "ready" || !stick.current) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [status, messages.length]);

  async function loadOlder() {
    if (!token || !cursor || loadingOlder) return;
    setLoadingOlder(true);
    stick.current = false;
    const before = document.documentElement.scrollHeight;
    try {
      const page = await fetchThread(token, conversationId, cursor);
      setMessages((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        return [...page.messages.filter((item) => !ids.has(item.id)), ...prev];
      });
      setCursor(page.nextCursor);
      requestAnimationFrame(() => {
        window.scrollBy(0, document.documentElement.scrollHeight - before);
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(body: string) {
    if (!token) return;
    const pending: ChatMessage = {
      id: `pending-${Date.now()}`,
      conversationId,
      body: body.trim(),
      createdAt: new Date().toISOString(),
      mine: true,
      sender: peer ?? { name: "You", handle: "you", initials: "Y" },
      pending: true,
    };
    stick.current = true;
    setMessages((prev) => [...prev, pending]);
    try {
      const { message, unreadMessages } = await sendChatMessage(token, conversationId, pending.body);
      setUnreadMessages(unreadMessages);
      setMessages((prev) => prev.map((item) => (item.id === pending.id ? message : item)));
    } catch {
      setMessages((prev) => prev.map((item) => (item.id === pending.id ? { ...item, pending: false, failed: true } : item)));
    }
  }

  if (status === "missing" || status === "error") {
    return (
      <>
        <PageHeader title="Message" back />
        <EmptyState
          title={status === "missing" ? "This conversation doesn't exist" : "Couldn't load this conversation"}
          body={status === "missing" ? "Pick another conversation from Messages." : "Check your connection and try again."}
        />
      </>
    );
  }

  return (
    <div className={threadFrame}>
      <PageHeader
        title={
          peer?.id ? (
            <Link href={`/square/u/${peer.id}`} className="hover:underline">
              {peer.name}
            </Link>
          ) : (
            "Message"
          )
        }
        subtitle={peer ? `@${peer.handle}` : undefined}
        back
      />
      <div className="flex flex-1 flex-col justify-end gap-2 px-4 py-4">
        {cursor && (
          <button
            type="button"
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
            className="mx-auto mb-2 text-sm font-semibold text-primary hover:underline disabled:opacity-60"
          >
            {loadingOlder ? "Loading…" : "Earlier messages"}
          </button>
        )}
        {status === "ready" && messages.length === 0 && peer && (
          <p className="pb-2 text-center text-sm text-muted-foreground">
            This is the start of your conversation with @{peer.handle}.
          </p>
        )}
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>
      {peer && <Composer handle={peer.handle} disabled={status !== "ready"} onSend={(body) => void send(body)} />}
    </div>
  );
}

export function NewConversation({ userId }: { userId: string }) {
  const router = useRouter();
  const me = useCurrentAuthor();
  const { token, ready, setUnreadMessages } = useSquare();
  const [peer, setPeer] = useState<Author | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    if (userId === me.id) {
      setStatus("missing");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetchProfile(token, userId)
      .then(async (profile) => {
        if (cancelled) return null;
        if (profile.id === me.id) {
          setStatus("missing");
          return null;
        }
        const existing = await fetchThreadWith(token, profile.id);
        if (cancelled) return null;
        if (existing) {
          router.replace(`/square/messages/${existing}`);
          return null;
        }
        setPeer(profile);
        setStatus("ready");
        return null;
      })
      .catch((err: Error) => !cancelled && setStatus(/not found/i.test(err.message) ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [ready, token, userId, me.id, router]);

  async function send(body: string) {
    if (!token || sending) return;
    setSending(true);
    setError(null);
    try {
      const { conversationId, unreadMessages } = await startConversation(token, peer?.id ?? userId, body);
      setUnreadMessages(unreadMessages);
      router.replace(`/square/messages/${conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that message");
      setSending(false);
    }
  }

  if (status === "missing" || status === "error") {
    return (
      <>
        <PageHeader title="New message" back />
        <EmptyState
          title={status === "missing" ? "This account doesn't exist" : "Couldn't start a conversation"}
          body={status === "missing" ? "Try someone else from the floor." : "Check your connection and try again."}
        />
      </>
    );
  }

  return (
    <div className={threadFrame}>
      <PageHeader
        title={peer?.name ?? "New message"}
        subtitle={peer ? `@${peer.handle}` : undefined}
        back
      />
      <div className="flex flex-1 flex-col justify-end px-4 py-4">
        <p className="pb-2 text-center text-sm text-muted-foreground">
          {peer ? `This is the start of your conversation with @${peer.handle}.` : "Loading…"}
        </p>
        {error && <p className="pt-2 text-sm text-bear">{error}</p>}
      </div>
      {peer && <Composer handle={peer.handle} disabled={sending || status !== "ready"} onSend={(body) => void send(body)} />}
    </div>
  );
}
