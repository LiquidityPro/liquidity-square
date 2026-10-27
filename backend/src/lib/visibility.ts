import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Posts still on the floor: not removed by staff, and the author has not been taken down. */
export function onTheFloor(): Prisma.PostWhereInput {
  return { removedAt: null, author: { suspendedAt: null } };
}

export class InteractionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Authors this viewer should not see: people they muted, people they blocked, and people who blocked them. */
export async function blockedAuthorIds(viewerId: string): Promise<string[]> {
  const [blocks, blockedBy] = await Promise.all([
    prisma.block.findMany({ where: { userId: viewerId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: viewerId }, select: { userId: true } }),
  ]);
  return Array.from(new Set([...blocks.map((row) => row.blockedId), ...blockedBy.map((row) => row.userId)]));
}

export async function hiddenAuthorIds(viewerId: string): Promise<string[]> {
  const [mutes, blocks, blockedBy] = await Promise.all([
    prisma.mute.findMany({ where: { userId: viewerId }, select: { mutedId: true } }),
    prisma.block.findMany({ where: { userId: viewerId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: viewerId }, select: { userId: true } }),
  ]);
  return Array.from(
    new Set([
      ...mutes.map((row) => row.mutedId),
      ...blocks.map((row) => row.blockedId),
      ...blockedBy.map((row) => row.userId),
    ]),
  );
}

export async function relationship(viewerId: string, otherId: string) {
  if (viewerId === otherId) return { mutedByMe: false, blockedByMe: false, blockedMe: false };
  const [muted, blocked, blockedBy] = await Promise.all([
    prisma.mute.findUnique({ where: { userId_mutedId: { userId: viewerId, mutedId: otherId } }, select: { userId: true } }),
    prisma.block.findUnique({ where: { userId_blockedId: { userId: viewerId, blockedId: otherId } }, select: { userId: true } }),
    prisma.block.findUnique({ where: { userId_blockedId: { userId: otherId, blockedId: viewerId } }, select: { userId: true } }),
  ]);
  return { mutedByMe: !!muted, blockedByMe: !!blocked, blockedMe: !!blockedBy };
}

export async function assertCanInteract(viewerId: string, otherId: string) {
  const state = await relationship(viewerId, otherId);
  if (state.blockedByMe || state.blockedMe) {
    throw new InteractionError("You can't interact with this account", 403);
  }
}

export async function isBlockedEitherWay(a: string, b: string) {
  const count = await prisma.block.count({
    where: { OR: [{ userId: a, blockedId: b }, { userId: b, blockedId: a }] },
  });
  return count > 0;
}
