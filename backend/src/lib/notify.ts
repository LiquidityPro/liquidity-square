import { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { notificationSelect, toNotificationDto } from "./notification-dto";
import { publishLiveNotification } from "./live-publish";
import { deliverPush } from "./push";
import { isBlockedEitherWay } from "./visibility";

type NotifyArgs = {
  type: NotificationType;
  actorId: string;
  recipientId: string;
  postId?: string | null;
};

// Notification failures are logged rather than thrown so they never fail the action that triggered them.
export async function notify({ type, actorId, recipientId, postId = null }: NotifyArgs): Promise<void> {
  if (actorId === recipientId) return;
  try {
    if (await isBlockedEitherWay(actorId, recipientId)) return;
    const notification = await prisma.notification.create({
      data: { type, actorId, recipientId, postId },
      select: notificationSelect,
    });
    await deliverPush(notification.id);
    await publishLiveNotification(recipientId, toNotificationDto(notification)).catch((error) =>
      console.error("Live notification failed", error),
    );
  } catch (error) {
    console.error("Create notification error:", error);
  }
}

export async function unnotify({ type, actorId, recipientId, postId = null }: NotifyArgs): Promise<void> {
  try {
    await prisma.notification.deleteMany({ where: { type, actorId, recipientId, postId } });
  } catch (error) {
    console.error("Delete notification error:", error);
  }
}
