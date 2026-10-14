import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { postInclude, toPostDto } from "../lib/post";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const liveRouter = Router();

liveRouter.use(authenticateJwt);

const LIVE_LIMIT = 50;
// First poll reaches back far enough to catch anything posted while the page was loading.
const LOOKBACK_MS = 15_000;
// Later polls overlap the previous window so a post committed mid-query is not skipped.
const OVERLAP_MS = 2_000;

// GET /api/live?since=<ISO>
// Newest posts and notifications since the client's cursor, plus the unread badge count.
liveRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const now = new Date();
    const sinceRaw = req.query.since;
    const parsed = typeof sinceRaw === "string" ? Date.parse(sinceRaw) : Number.NaN;
    const after = Number.isNaN(parsed) ? new Date(now.getTime() - LOOKBACK_MS) : new Date(parsed - OVERLAP_MS);

    const [unreadCount, posts, notifications] = await Promise.all([
      prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
      prisma.post.findMany({
        where: { createdAt: { gt: after, lte: now } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: LIVE_LIMIT,
        include: postInclude(userId),
      }),
      prisma.notification.findMany({
        where: { recipientId: userId, createdAt: { gt: after, lte: now } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: LIVE_LIMIT,
        select: {
          id: true,
          type: true,
          readAt: true,
          createdAt: true,
          actor: { select: AUTHOR_SELECT },
          post: { select: { id: true, body: true } },
        },
      }),
    ]);

    res.status(200).json({
      now: now.toISOString(),
      unreadCount,
      posts: posts.map(toPostDto),
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
        actor: toAuthorDto(n.actor),
        post: n.post,
      })),
    });
  } catch (error) {
    console.error("Live update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
