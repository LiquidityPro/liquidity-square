import { Router, Response } from "express";
import { Prisma, Stance } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const draftsRouter = Router();

draftsRouter.use(authenticateJwt);

const BODY_LIMIT = 280;
const DRAFT_LIMIT = 25;
const MIN_LEAD_MS = 60_000;
const MAX_LEAD_MS = 1000 * 60 * 60 * 24 * 365;

type PollOptionInput = { label: string; stance: Stance | null };

function parsePoll(raw: unknown): PollOptionInput[] | null | "invalid" {
  if (raw == null) return null;
  if (typeof raw !== "object" || !Array.isArray((raw as { options?: unknown }).options)) return "invalid";
  const options = (raw as { options: unknown[] }).options;
  if (options.length < 2 || options.length > 4) return "invalid";

  const parsed: PollOptionInput[] = [];
  for (const option of options) {
    if (!option || typeof option !== "object") return "invalid";
    const label = typeof (option as { label?: unknown }).label === "string" ? (option as { label: string }).label.trim() : "";
    const stance = (option as { stance?: unknown }).stance ?? null;
    if (!label || label.length > 40) return "invalid";
    if (stance != null && stance !== Stance.bull && stance !== Stance.bear) return "invalid";
    parsed.push({ label, stance });
  }
  return parsed;
}

function parseWhen(raw: unknown): Date | null | "invalid" {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return "invalid";
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return "invalid";
  const lead = when.getTime() - Date.now();
  if (lead < MIN_LEAD_MS || lead > MAX_LEAD_MS) return "invalid";
  return when;
}

function toDraftDto(draft: {
  id: string;
  body: string;
  stance: Stance | null;
  poll: Prisma.JsonValue;
  scheduledFor: Date | null;
  updatedAt: Date;
}) {
  return {
    id: draft.id,
    body: draft.body,
    stance: draft.stance,
    poll: draft.poll,
    scheduledFor: draft.scheduledFor?.toISOString() ?? null,
    updatedAt: draft.updatedAt.toISOString(),
  };
}

function readFields(body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const text = typeof record.body === "string" ? record.body.trim() : "";
  const stance = record.stance ?? null;
  const poll = parsePoll(record.poll);
  const scheduledFor = parseWhen(record.scheduledFor);
  return { text, stance, poll, scheduledFor };
}

function rejectFields(
  res: Response,
  fields: ReturnType<typeof readFields>,
): fields is { text: string; stance: Stance | null; poll: PollOptionInput[] | null; scheduledFor: Date | null } {
  if (!fields.text) {
    res.status(400).json({ error: "Write something before saving a draft" });
    return false;
  }
  if (fields.text.length > BODY_LIMIT) {
    res.status(400).json({ error: `Posts are limited to ${BODY_LIMIT} characters` });
    return false;
  }
  if (fields.stance != null && fields.stance !== Stance.bull && fields.stance !== Stance.bear) {
    res.status(400).json({ error: 'Stance must be "bull", "bear" or null' });
    return false;
  }
  if (fields.poll === "invalid") {
    res.status(400).json({ error: "A poll needs 2 to 4 options, each 40 characters or fewer" });
    return false;
  }
  if (fields.scheduledFor === "invalid") {
    res.status(400).json({ error: "Pick a time at least a minute from now, and within a year" });
    return false;
  }
  return true;
}

draftsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const drafts = await prisma.draft.findMany({
      where: { authorId: req.userId! },
      orderBy: { updatedAt: "desc" },
      take: DRAFT_LIMIT,
    });
    res.status(200).json({ drafts: drafts.map(toDraftDto) });
  } catch (error) {
    console.error("List drafts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

draftsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const fields = readFields(req.body);
    if (!rejectFields(res, fields)) return;

    const count = await prisma.draft.count({ where: { authorId: userId } });
    if (count >= DRAFT_LIMIT) {
      res.status(400).json({ error: `You can keep up to ${DRAFT_LIMIT} drafts` });
      return;
    }

    const draft = await prisma.draft.create({
      data: {
        authorId: userId,
        body: fields.text,
        stance: fields.stance,
        poll: fields.poll ?? Prisma.JsonNull,
        scheduledFor: fields.scheduledFor,
      },
    });
    res.status(201).json({ draft: toDraftDto(draft) });
  } catch (error) {
    console.error("Create draft error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

draftsRouter.put("/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const fields = readFields(req.body);
    if (!rejectFields(res, fields)) return;

    const existing = await prisma.draft.findUnique({
      where: { id: req.params.id },
      select: { authorId: true },
    });
    if (!existing || existing.authorId !== req.userId) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const draft = await prisma.draft.update({
      where: { id: req.params.id },
      data: {
        body: fields.text,
        stance: fields.stance,
        poll: fields.poll ?? Prisma.JsonNull,
        scheduledFor: fields.scheduledFor,
      },
    });
    res.status(200).json({ draft: toDraftDto(draft) });
  } catch (error) {
    console.error("Update draft error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

draftsRouter.delete("/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const existing = await prisma.draft.findUnique({
      where: { id: req.params.id },
      select: { authorId: true },
    });
    if (!existing || existing.authorId !== req.userId) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    await prisma.draft.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    console.error("Delete draft error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
