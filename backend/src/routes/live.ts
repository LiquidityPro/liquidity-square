import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT } from "../lib/author";
import { notificationSelect, toNotificationDto } from "../lib/notification-dto";
import { postInclude, toPostDto } from "../lib/post";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import { toMessageDto, unreadMessageCount } from "../lib/messages";
import { hiddenAuthorIds } from "../lib/visibility";
import { subscribeLive, type LiveFrame } from "../lib/live-hub";

export const liveRouter = Router();

liveRouter.use(authenticateJwt);

const LIVE_LIMIT = 50;
const LOOKBACK_MS = 15_000;
const OVERLAP_MS = 2_000;
const HEARTBEAT_MS = 20_000;

function sinceDate(raw: unknown) {
  const now = new Date();
  const parsed = typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  const after = Number.isNaN(parsed) ? new Date(now.getTime() - LOOKBACK_MS) : new Date(parsed - OVERLAP_MS);
  return { now, after };
}

async function loadSnapshot(userId: string, sinceRaw: unknown): Promise<LiveFrame> {
  const hidden = await hiddenAuthorIds(userId);
  const { now, after } = sinceDate(sinceRaw);
  const [unreadCount, unreadMessages, posts, notifications, messages, reads] = await Promise.all([
    prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
    unreadMessageCount(userId),
    prisma.post.findMany({
      where: {
        createdAt: { gt: after, lte: now },
        ...(hidden.length ? { authorId: { notIn: hidden } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LIVE_LIMIT,
      include: postInclude(userId),
    }),
    prisma.notification.findMany({
      where: { recipientId: userId, createdAt: { gt: after, lte: now } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LIVE_LIMIT,
      select: notificationSelect,
    }),
    prisma.directMessage.findMany({
      where: {
        createdAt: { gt: after, lte: now },
        conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
      },
      orderBy: { createdAt: "asc" },
      take: LIVE_LIMIT,
      include: { sender: { select: AUTHOR_SELECT } },
    }),
    prisma.conversationRead.findMany({
      where: {
        userId: { not: userId },
        lastReadAt: { gt: after, lte: now },
        conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
      },
      select: { conversationId: true, lastReadAt: true },
      take: LIVE_LIMIT,
    }),
  ]);

  return {
    now: now.toISOString(),
    unreadCount,
    unreadMessages,
    posts: posts.map(toPostDto),
    messages: messages.map((message) => toMessageDto(message, userId)),
    reads: reads.map((read) => ({
      conversationId: read.conversationId,
      readAt: read.lastReadAt.toISOString(),
    })),
    notifications: notifications.map(toNotificationDto),
  };
}

function writeFrame(res: Response, frame: LiveFrame) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(frame)}\n\n`);
}

// GET /api/live/stream — one open event stream. The first event is a snapshot; later events are pushes.
liveRouter.get("/stream", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  req.socket?.setTimeout(0);
  res.write(": open\n\n");

  let live = false;
  const waiting: LiveFrame[] = [];
  const unsubscribe = subscribeLive(userId, (frame) => {
    if (live) writeFrame(res, frame);
    else waiting.push(frame);
  });

  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": ping\n\n");
  }, HEARTBEAT_MS);
  heartbeat.unref();

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    if (!res.writableEnded) res.end();
  };
  req.on("close", close);

  try {
    const snapshot = await loadSnapshot(userId, req.query.since);
    if (closed) return;
    writeFrame(res, snapshot);
    live = true;
    for (const frame of waiting.splice(0)) writeFrame(res, frame);
  } catch (error) {
    console.error("Live stream error:", error);
    close();
  }
});
