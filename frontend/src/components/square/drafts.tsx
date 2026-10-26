"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteDraft, fetchDrafts, relativeTime, type SavedDraft } from "./api";
import { useSquare } from "./context";
import { EmptyState } from "./page-chrome";

const EDIT_KEY = "square-edit-draft";

export function rememberDraft(draft: SavedDraft) {
  sessionStorage.setItem(EDIT_KEY, JSON.stringify(draft));
}

export function takeRememberedDraft(): SavedDraft | null {
  const raw = sessionStorage.getItem(EDIT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(EDIT_KEY);
  try {
    const draft = JSON.parse(raw) as SavedDraft;
    if (!draft?.id || typeof draft.body !== "string") return null;
    return draft;
  } catch {
    return null;
  }
}

export function DraftList({
  onEdit,
}: {
  onEdit?: (draft: SavedDraft) => void;
}) {
  const router = useRouter();
  const { token, ready } = useSquare();
  const [drafts, setDrafts] = useState<SavedDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    fetchDrafts(token)
      .then((rows) => {
        if (!cancelled) setDrafts(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  async function remove(draft: SavedDraft) {
    if (!token) return;
    const previous = drafts ?? [];
    setDrafts(previous.filter((row) => row.id !== draft.id));
    try {
      await deleteDraft(token, draft.id);
    } catch (err) {
      setDrafts(previous);
      toast.error(err instanceof Error ? err.message : "Couldn't delete that draft");
    }
  }

  function edit(draft: SavedDraft) {
    if (onEdit) {
      onEdit(draft);
      return;
    }
    rememberDraft(draft);
    router.push("/square");
  }

  if (error) {
    return <EmptyState title="Couldn't load drafts" body={error} />;
  }
  if (!drafts) {
    return (
      <div className="space-y-3 px-4 py-4" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    );
  }
  if (drafts.length === 0) {
    return <EmptyState title="No drafts" body="Start a post and leave it. It will wait for you here." />;
  }

  return (
    <ul>
      {drafts.map((draft) => (
        <li key={draft.id} className="border-b px-4 py-3">
          <p className="line-clamp-3 whitespace-pre-wrap text-[15px]">{draft.body}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {draft.scheduledFor
              ? `Scheduled ${new Date(draft.scheduledFor).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : `Draft · ${relativeTime(draft.updatedAt)}`}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => edit(draft)} className="min-h-8 rounded-full border px-3 text-sm font-semibold">
              Edit
            </button>
            <button
              type="button"
              onClick={() => void remove(draft)}
              className="min-h-8 rounded-full px-3 text-sm font-semibold text-bear"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
