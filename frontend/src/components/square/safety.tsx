"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reportContent } from "./api";
import { useSquare } from "./context";
import type { ReportReason } from "./data";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment" },
  { id: "misinformation", label: "Misinformation" },
  { id: "other", label: "Something else" },
];

export function ReportDialog({
  open,
  onOpenChange,
  postId,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  userId?: string;
}) {
  const { token } = useSquare();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!token || sending) return;
    setSending(true);
    try {
      await reportContent(token, { reason, note, postId, userId });
      toast.success("Report sent");
      setNote("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the report");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent onClick={(event) => event.stopPropagation()} className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {REASONS.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="report-reason"
                checked={reason === item.id}
                onChange={() => setReason(item.id)}
              />
              {item.label}
            </label>
          ))}
          <textarea
            value={note}
            maxLength={280}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add context if you want"
            className="mt-2 min-h-20 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          type="button"
          disabled={sending}
          onClick={() => void submit()}
          className="min-h-9 rounded-full bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send report"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
