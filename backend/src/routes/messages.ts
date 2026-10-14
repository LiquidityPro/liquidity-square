import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import {
  INBOX_LIMIT,
  MESSAGE_PAGE,
  MessageError,
  appendMessage,
  markConversationRead,
  openConversation,
  peerReadAt,
  requireMembership,
  toMessageDto,
  unreadMessageCount,
} from "../lib/messages";

export const messagesRouter = Router();

messagesRouter.use(authenticateJwt);

function fail(res: Response, error: unknown, label: string) {
  if (error instanceof MessageError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(label, error);
  res.status(500).json({ error: "Internal server error" });
}

// GET /api/messages — inbox, newest activity first
messagesRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const rows = await prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { updatedAt: "desc" },
      take: INBOX_LIMIT,
      include: {
        userA: { select: AUTHOR_SELECT },
        userB: { select: AUTHOR_SELECT },
        reads: { where: { userId }, select: { lastReadAt: true }, take: 1 },
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: { id: true } } } },
      },
    });

    const conversations = rows.flatMap((row) => {
      const last = row.messages[0];
      if (!last) return [];
      const peer = row.userAId === userId ? row.userB : row.userA;
      const readAt = row.reads[0]?.lastReadAt;
      const unread = last.senderId !== userId && (!readAt || readAt < last.createdAt);
      return [
        {
          id: row.id,
          with: toAuthorDto(peer),
          unread,
          lastMessage: {
            id: last.id,
            body: last.body,
            createdAt: last.createdAt.toISOString(),
            mine: last.senderId === userId,
          },
        },
      ];
    });

    res.status(200).json({ conversations });
  } catch (error) {
    fail(res, error, "List messages error:");
  }
});

// GET /api/messages/with/:userId — the existing thread with this person, if one has been started
messagesRouter.get("/with/:userId", async (req: AuthenticatedRequest<{ userId: string }>, res: Response): Promise<void> => {
  try {
    const me = req.userId!;
    const other = req.params.userId;
    if (me === other) {
      res.status(400).json({ error: "You can't message yourself" });
      return;
    }
    const [userAId, userBId] = me < other ? [me, other] : [other, me];
    const conversation = await prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true },
    });
    res.status(200).json({ conversationId: conversation?.id ?? null });
  } catch (error) {
    fail(res, error, "Lookup conversation error:");
  }
});

// POST /api/messages — start a thread, or continue it, with the first line
messagesRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const other = typeof req.body?.userId === "string" ? req.body.userId : "";
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    const conversation = await openConversation(userId, other);
    const message = await appendMessage(conversation.id, userId, body);
    const peerId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
    const peer = await prisma.user.findUniqueOrThrow({ where: { id: peerId }, select: AUTHOR_SELECT });
    res.status(201).json({
      conversation: { id: conversation.id, with: toAuthorDto(peer) },
      message: toMessageDto(message, userId),
      unreadMessages: await unreadMessageCount(userId),
    });
  } catch (error) {
    fail(res, error, "Start conversation error:");
  }
});

// GET /api/messages/:id?cursor= — one page of the thread, oldest-of-page first
messagesRouter.get("/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { peer } = await requireMembership(req.params.id, userId);
    const cursor = typeof req.query.cursor === "string" && req.query.cursor ? req.query.cursor : null;
    const rows = await prisma.directMessage.findMany({
      where: { conversationId: req.params.id },
      include: { sender: { select: AUTHOR_SELECT } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MESSAGE_PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, MESSAGE_PAGE).reverse();
    res.status(200).json({
      conversation: { id: req.params.id, with: peer },
      messages: page.map((message) => toMessageDto(message, userId)),
      nextCursor: rows.length > MESSAGE_PAGE ? page[0]?.id ?? null : null,
      peerReadAt: await peerReadAt(req.params.id, userId),
    });
  } catch (error) {
    fail(res, error, "Read conversation error:");
  }
});

// POST /api/messages/:id — send into an existing thread
messagesRouter.post("/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    await requireMembership(req.params.id, userId);
    const body = typeof req.body?.body === "string" ? req.body.body : "";
    const message = await appendMessage(req.params.id, userId, body);
    res.status(201).json({
      message: toMessageDto(message, userId),
      unreadMessages: await unreadMessageCount(userId),
    });
  } catch (error) {
    fail(res, error, "Send message error:");
  }
});

// POST /api/messages/:id/read — mark the thread read up to now
messagesRouter.post("/:id/read", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const unreadMessages = await markConversationRead(req.params.id, req.userId!);
    res.status(200).json({ unreadMessages });
  } catch (error) {
    fail(res, error, "Mark conversation read error:");
  }
});
