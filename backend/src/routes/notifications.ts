import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { pageSize } from "../lib/post";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.use(authenticateJwt);

// GET /api/notifications?cursor=<notificationId>&limit=50
notificationsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = pageSize(req.query.limit);
    const { cursor } = req.query;

    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.userId! },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(typeof cursor === "string" && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        type: true,
        readAt: true,
        createdAt: true,
        actor: { select: AUTHOR_SELECT },
        post: { select: { id: true, body: true } },
      },
    });

    const page = notifications.slice(0, limit);
    res.status(200).json({
      notifications: page.map((n) => ({
        id: n.id,
        type: n.type,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
        actor: toAuthorDto(n.actor),
        post: n.post,
      })),
      nextCursor: notifications.length > limit ? page[page.length - 1].id : null,
    });
  } catch (error) {
    console.error("List notifications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/notifications/unread-count
notificationsRouter.get("/unread-count", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const count = await prisma.notification.count({ where: { recipientId: req.userId!, readAt: null } });
    res.status(200).json({ count });
  } catch (error) {
    console.error("Unread count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/notifications/read — mark everything as read
notificationsRouter.post("/read", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { recipientId: req.userId!, readAt: null },
      data: { readAt: new Date() },
    });
    res.status(204).end();
  } catch (error) {
    console.error("Mark notifications read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
