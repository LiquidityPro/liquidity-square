import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { AUTHOR_SELECT, toAuthorDto } from "./author";

export const MESSAGE_LIMIT = 1000;
export const MESSAGE_PAGE = 40;
export const INBOX_LIMIT = 50;

export class MessageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type MessageRow = Prisma.DirectMessageGetPayload<{ include: { sender: { select: typeof AUTHOR_SELECT } } }>;

export function toMessageDto(message: MessageRow, viewerId: string) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    mine: message.senderId === viewerId,
    sender: toAuthorDto(message.sender),
  };
}

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function unreadMessageCount(userId: string) {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: {
      reads: { where: { userId }, select: { lastReadAt: true }, take: 1 },
      messages: {
        where: { senderId: { not: userId } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  return rows.filter((row) => {
    const latest = row.messages[0]?.createdAt;
    if (!latest) return false;
    const readAt = row.reads[0]?.lastReadAt;
    return !readAt || readAt < latest;
  }).length;
}

export async function openConversation(me: string, other: string) {
  if (me === other) throw new MessageError("You can't message yourself", 400);
  const recipient = await prisma.user.findUnique({ where: { id: other }, select: { id: true } });
  if (!recipient) throw new MessageError("User not found", 404);

  const [userAId, userBId] = pair(me, other);
  const existing = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (existing) return existing;

  try {
    return await prisma.conversation.create({ data: { userAId, userBId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.conversation.findUniqueOrThrow({ where: { userAId_userBId: { userAId, userBId } } });
    }
    throw error;
  }
}

const messageInclude = { sender: { select: AUTHOR_SELECT } } as const;

export async function appendMessage(conversationId: string, senderId: string, body: string) {
  const text = body.trim();
  if (!text) throw new MessageError("Message can't be empty", 400);
  if (text.length > MESSAGE_LIMIT) throw new MessageError(`Messages are limited to ${MESSAGE_LIMIT} characters`, 400);

  return prisma.$transaction(async (tx) => {
    const created = await tx.directMessage.create({
      data: { conversationId, senderId, body: text },
      include: messageInclude,
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: created.createdAt },
    });
    await tx.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      create: { conversationId, userId: senderId, lastReadAt: created.createdAt },
      update: { lastReadAt: created.createdAt },
    });
    return created;
  });
}

export async function requireMembership(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: AUTHOR_SELECT },
      userB: { select: AUTHOR_SELECT },
    },
  });
  if (!conversation) throw new MessageError("Conversation not found", 404);
  const peer = conversation.userAId === userId ? conversation.userB : conversation.userA;
  return { conversation, peer: toAuthorDto(peer) };
}

export async function markConversationRead(conversationId: string, userId: string) {
  await requireMembership(conversationId, userId);
  const now = new Date();
  await prisma.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
  return unreadMessageCount(userId);
}
