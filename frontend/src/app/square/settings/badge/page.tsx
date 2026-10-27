"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/square/parts";
import { useSquare } from "@/components/square/context";
import { fetchBadgeApplication, submitBadgeApplication, type BadgeApplication } from "@/components/square/api";

const BADGE_LABEL = {
  none: "No badge",
  member: "Member",
  professional: "Professional",
  distinguished: "Distinguished",
} as const;

export default function BadgeApplicationPage() {
  const { token, ready } = useSquare();
  const [badge, setBadge] = useState<"none" | "member" | "professional" | "distinguished">("none");
  const [title, setTitle] = useState<string | null>(null);
  const [application, setApplication] = useState<BadgeApplication | null>(null);
  const [firm, setFirm] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    fetchBadgeApplication(token)
      .then((data) => {
        if (cancelled) return;
        setBadge(data.badge);
        setTitle(data.title);
        setApplication(data.application);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your application");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  const held = badge === "professional" || badge === "distinguished";
  const pending = application?.status === "pending";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const next = await submitBadgeApplication(token, { firm, proofUrl, note });
      setApplication(next);
      setFirm("");
      setProofUrl("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Professional badge" subtitle="Green is applied for. Gold is chosen by the desk." back />
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm text-muted-foreground">
          Your badge now: <span className="font-semibold text-foreground">{BADGE_LABEL[badge]}</span>
          {title ? ` · ${title}` : ""}
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {held && (
          <p className="text-sm">
            You already carry a {badge === "distinguished" ? "gold" : "green"} badge. It is not something you apply for again.
          </p>
        )}
        {pending && application && (
          <article className="rounded-lg border p-4">
            <p className="font-semibold">In review</p>
            <p className="mt-1 text-sm text-muted-foreground">{application.firm}</p>
            <p className="mt-2 text-sm">{application.note}</p>
          </article>
        )}
        {!held && !pending && (
          <form className="space-y-3" onSubmit={onSubmit}>
            {!title && <p className="text-sm">Add a title on your profile before you apply.</p>}
            {application?.status === "declined" && (
              <p className="text-sm">
                The last application was declined{application.decisionNote ? `: ${application.decisionNote}` : "."} You can send another.
              </p>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Firm</span>
              <input className="w-full rounded-md border bg-card px-3 py-2" value={firm} onChange={(event) => setFirm(event.target.value)} required />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Public proof link</span>
              <input className="w-full rounded-md border bg-card px-3 py-2" type="url" placeholder="https://" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} required />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Why this badge</span>
              <textarea className="min-h-24 w-full rounded-md border bg-card px-3 py-2" maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} required />
            </label>
            <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={busy || !title}>
              {busy ? "Sending…" : "Apply"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
