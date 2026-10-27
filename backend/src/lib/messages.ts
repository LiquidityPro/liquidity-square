import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { AUTHOR_SELECT, toAuthorDto } from "./author";
import { liveFanout, liveUserIds, type LiveFrame } from "./live-hub";
import { InteractionError, assertCanInteract } from "./visibility";

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
  try {
    await assertCanInteract(me, other);
  } catch (error) {
    if (error instanceof InteractionError) throw new MessageError(error.message, error.status);
    throw error;
  }
  const recipient = await prisma.user.findUnique({ where: { id: other }, select: { id: true, suspendedAt: true } });
  if (!recipient || recipient.suspendedAt) throw new MessageError("User not found", 404);

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

  const parties = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userA: { select: { suspendedAt: true } }, userB: { select: { suspendedAt: true } } },
  });
  if (!parties || parties.userA.suspendedAt || parties.userB.suspendedAt) {
    throw new MessageError("User not found", 404);
  }

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.directMessage.create({
      data: { conversationId, senderId, body: text },
      include: messageInclude,
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: message.createdAt },
    });
    await tx.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      create: { conversationId, userId: senderId, lastReadAt: message.createdAt },
      update: { lastReadAt: message.createdAt },
    });
    return message;
  });
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userAId: true, userBId: true },
  });
  if (conversation) {
    await publishLiveMessage(created, [conversation.userAId, conversation.userBId]).catch((error) =>
      console.error("Live message failed", error),
    );
  }
  return created;
}

/** When the other person last opened this thread. */
export async function peerReadAt(conversationId: string, viewerId: string) {
  const read = await prisma.conversationRead.findFirst({
    where: { conversationId, userId: { not: viewerId } },
    select: { lastReadAt: true },
  });
  return read?.lastReadAt.toISOString() ?? null;
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
  const peerUser = conversation.userAId === userId ? conversation.userB : conversation.userA;
  try {
    await assertCanInteract(userId, peerUser.id);
  } catch (error) {
    if (error instanceof InteractionError) throw new MessageError(error.message, error.status);
    throw error;
  }
  return { conversation, peer: toAuthorDto(peerUser) };
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { conversation } = await requireMembership(conversationId, userId);
  const now = new Date();
  await prisma.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
  const unreadMessages = await unreadMessageCount(userId);
  const peerId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
  publishLiveRead(conversationId, userId, peerId, now, unreadMessages);
  return unreadMessages;
}

function liveFrame(now: string, extra: Partial<LiveFrame> = {}): LiveFrame {
  return { now, posts: [], notifications: [], messages: [], reads: [], ...extra };
}

async function publishLiveMessage(message: MessageRow, participantIds: string[]) {
  const online = new Set(liveUserIds());
  const targets = participantIds.filter((id) => online.has(id));
  if (targets.length === 0) return;
  const unread = new Map<string, number>();
  for (const id of targets) {
    if (id !== message.senderId) unread.set(id, await unreadMessageCount(id));
  }
  const now = new Date().toISOString();
  liveFanout((userId) => {
    if (!targets.includes(userId)) return null;
    const unreadMessages = unread.get(userId);
    return liveFrame(now, {
      ...(unreadMessages != null ? { unreadMessages } : {}),
      messages: [toMessageDto(message, userId)],
    });
  });
}

function publishLiveRead(
  conversationId: string,
  readerId: string,
  peerId: string,
  readAt: Date,
  readerUnread: number,
) {
  const online = new Set(liveUserIds());
  if (!online.has(readerId) && !online.has(peerId)) return;
  const now = new Date().toISOString();
  const read = { conversationId, readAt: readAt.toISOString() };
  liveFanout((userId) => {
    if (userId === readerId) return liveFrame(now, { unreadMessages: readerUnread });
    if (userId === peerId) return liveFrame(now, { reads: [read] });
    return null;
  });
}
