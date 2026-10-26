import { Prisma, Stance } from "@prisma/client";
import { prisma } from "./prisma";
import { postInclude, toPostDto } from "./post";
import { publishLivePost } from "./live-publish";

const TICKER_RE = /\$([A-Z]{2,12})/g;
const POLL_MS = 30_000;

let pollerStarted = false;

type PollOption = { label: string; stance: Stance | null };

type DraftRow = {
  id: string;
  authorId: string;
  body: string;
  stance: Stance | null;
  poll: Prisma.JsonValue;
  scheduledFor: Date | null;
};

function extractTickers(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(TICKER_RE), (m) => m[1])));
}

function parseStoredPoll(raw: Prisma.JsonValue): PollOption[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Array.isArray((raw as { options?: unknown }).options)) {
    return null;
  }
  const options = (raw as { options: unknown[] }).options;
  const parsed: PollOption[] = [];
  for (const option of options) {
    if (!option || typeof option !== "object") return null;
    const label = typeof (option as { label?: unknown }).label === "string" ? (option as { label: string }).label.trim() : "";
    const stance = (option as { stance?: unknown }).stance ?? null;
    if (!label || label.length > 40) return null;
    if (stance != null && stance !== Stance.bull && stance !== Stance.bear) return null;
    parsed.push({ label, stance });
  }
  if (parsed.length < 2 || parsed.length > 4) return null;
  return parsed;
}

async function publishDraft(draft: DraftRow) {
  const poll = parseStoredPoll(draft.poll);
  const symbols = extractTickers(draft.body);
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    const removed = await tx.draft.deleteMany({
      where: { id: draft.id, scheduledFor: { lte: now } },
    });
    if (removed.count !== 1) return null;

    return tx.post.create({
      data: {
        body: draft.body,
        stance: draft.stance,
        authorId: draft.authorId,
        tickers: {
          connectOrCreate: symbols.map((symbol) => ({
            where: { symbol },
            create: { symbol },
          })),
        },
        ...(poll
          ? {
              poll: {
                create: {
                  options: {
                    create: poll.map((option, position) => ({
                      label: option.label,
                      stance: option.stance,
                      position,
                    })),
                  },
                },
              },
            }
          : {}),
      },
      include: postInclude(draft.authorId),
    });
  });
  if (created) {
    await publishLivePost(toPostDto(created)).catch((error) => console.error("Live post failed", error));
  }
}

/** Turns due scheduled drafts into posts. Safe to run from more than one server. */
export async function publishDueDrafts() {
  const due = await prisma.draft.findMany({
    where: { scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: 20,
  });
  for (const draft of due) {
    try {
      await publishDraft(draft);
    } catch (error) {
      console.error(`Scheduled post failed (${draft.id})`, error);
    }
  }
}

export function startDraftPoller() {
  if (pollerStarted) return;
  pollerStarted = true;
  const tick = () => {
    publishDueDrafts().catch((error) => console.error("Draft poll failed", error));
  };
  setTimeout(tick, 5_000);
  setInterval(tick, POLL_MS);
}
