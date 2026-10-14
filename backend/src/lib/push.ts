import * as webpush from "web-push";
import { prisma } from "./prisma";

type PushPayload = {
  id: string;
  title: string;
  body: string;
  url: string;
};

const COPY = {
  like: "liked your post",
  follow: "followed you",
  reply: "replied to your post",
  repost: "reposted your post",
} as const;

let configured = false;

function vapidReady(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:notifications@liquiditysquare.app", publicKey, privateKey);
    configured = true;
  }
  return true;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function deliverPush(notificationId: string): Promise<void> {
  if (!vapidReady()) return;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        type: true,
        recipientId: true,
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        post: { select: { id: true, body: true } },
      },
    });
    if (!notification) return;

    const name = `${notification.actor.firstName} ${notification.actor.lastName}`.trim() || notification.actor.email;
    const payload: PushPayload = {
      id: notification.id,
      title: `${name} ${COPY[notification.type]}`,
      body: notification.post?.body.slice(0, 140) ?? "Open The Square to see it.",
      url: notification.post ? `/square/post/${notification.post.id}` : `/square/u/${notification.actor.id}`,
    };

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: notification.recipientId },
    });
    if (subscriptions.length === 0) return;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(payload),
          );
        } catch (error) {
          const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
            return;
          }
          console.error("Push delivery error:", error);
        }
      }),
    );
  } catch (error) {
    console.error("Push delivery error:", error);
  }
}
