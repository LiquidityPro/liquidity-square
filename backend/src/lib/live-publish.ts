import { prisma } from "./prisma";
import { toPostDto } from "./post";
import { toNotificationDto } from "./notification-dto";
import { liveFanout, liveUserIds, type LiveFrame } from "./live-hub";

type NotificationDto = ReturnType<typeof toNotificationDto>;

function frame(now: string, extra: Partial<LiveFrame> = {}): LiveFrame {
  return { now, posts: [], notifications: [], messages: [], reads: [], ...extra };
}

async function viewersHiding(authorId: string, viewerIds: string[]) {
  const hidden = new Set<string>();
  if (!authorId || viewerIds.length === 0) return hidden;
  const [mutes, blocks] = await Promise.all([
    prisma.mute.findMany({
      where: { mutedId: authorId, userId: { in: viewerIds } },
      select: { userId: true },
    }),
    prisma.block.findMany({
      where: {
        OR: [
          { blockedId: authorId, userId: { in: viewerIds } },
          { userId: authorId, blockedId: { in: viewerIds } },
        ],
      },
      select: { userId: true, blockedId: true },
    }),
  ]);
  for (const row of mutes) hidden.add(row.userId);
  for (const row of blocks) {
    if (row.blockedId === authorId) hidden.add(row.userId);
    if (row.userId === authorId) hidden.add(row.blockedId);
  }
  return hidden;
}

export function publishLiveRemoval(removed: { postIds?: string[]; authorIds?: string[] }) {
  const removedPostIds = removed.postIds ?? [];
  const removedAuthorIds = removed.authorIds ?? [];
  if (removedPostIds.length === 0 && removedAuthorIds.length === 0) return;
  if (liveUserIds().length === 0) return;
  const now = new Date().toISOString();
  liveFanout(() => frame(now, { removedPostIds, removedAuthorIds }));
}

export async function publishLivePost(post: ReturnType<typeof toPostDto>) {
  const viewers = liveUserIds();
  if (viewers.length === 0) return;
  const hidden = await viewersHiding(post.author.id, viewers);
  const now = new Date().toISOString();
  liveFanout((userId) => (hidden.has(userId) ? null : frame(now, { posts: [post] })));
}

export async function publishLiveNotification(recipientId: string, notification: NotificationDto) {
  if (!liveUserIds().includes(recipientId)) return;
  const unreadCount = await prisma.notification.count({ where: { recipientId, readAt: null } });
  const now = new Date().toISOString();
  liveFanout((userId) =>
    userId === recipientId ? frame(now, { unreadCount, notifications: [notification] }) : null,
  );
}

export function publishLiveUnread(userId: string, unreadCount: number) {
  if (!liveUserIds().includes(userId)) return;
  const now = new Date().toISOString();
  liveFanout((id) => (id === userId ? frame(now, { unreadCount }) : null));
}
