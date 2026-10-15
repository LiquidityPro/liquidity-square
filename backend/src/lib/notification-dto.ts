import { Prisma } from "@prisma/client";
import { AUTHOR_SELECT, toAuthorDto } from "./author";

const SQUARE = { id: "", name: "The Square", handle: "square", initials: "SQ", image: null, title: null };

export const notificationSelect = {
  id: true,
  type: true,
  readAt: true,
  createdAt: true,
  symbol: true,
  summary: true,
  href: true,
  actor: { select: AUTHOR_SELECT },
  post: { select: { id: true, body: true } },
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

export function toNotificationDto(notification: NotificationRow) {
  return {
    id: notification.id,
    type: notification.type,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
    symbol: notification.symbol,
    summary: notification.summary,
    href: notification.href,
    actor: notification.actor ? toAuthorDto(notification.actor) : SQUARE,
    post: notification.post,
  };
}
