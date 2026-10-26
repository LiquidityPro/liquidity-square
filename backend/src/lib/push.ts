import https from "node:https";
import * as webpush from "web-push";
import { prisma } from "./prisma";

const pushAgent = new https.Agent({
  keepAlive: true,
  family: 4,
  timeout: 10_000,
});

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
  quote: "quoted your post",
  alert: "Price alert",
  disclosure: "New NGX filing",
  filings: "New NGX filings",
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

function endpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "push service";
  }
}

function pushFailure(error: unknown) {
  const list =
    error && typeof error === "object" && "errors" in error && Array.isArray(error.errors) ? error.errors : [error];
  const codes = list.flatMap((item) =>
    item && typeof item === "object" && "code" in item && typeof item.code === "string" ? [item.code] : [],
  );
  if (codes.length > 0) return [...new Set(codes)].join(", ");
  return error instanceof Error ? error.message : "request failed";
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
        symbol: true,
        summary: true,
        href: true,
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        post: { select: { id: true, body: true } },
      },
    });
    if (!notification) return;

    const payload: PushPayload =
      notification.type === "disclosure"
        ? {
            id: notification.id,
            title: notification.summary || COPY.disclosure,
            body: "A new filing is on the NGX disclosures list.",
            url: notification.href || (notification.symbol ? `/square/${notification.symbol}` : "/square/notifications"),
          }
        : notification.type === "filings"
        ? {
            id: notification.id,
            title: "New NGX filings",
            body: "See the latest filings on The Square.",
            url: notification.href || "/square/notifications?tab=filings",
          }
        : notification.type === "alert"
        ? {
            id: notification.id,
            title: notification.summary || COPY.alert,
            body: notification.symbol ? `Open $${notification.symbol} on The Square.` : "Open The Square to see it.",
            url: notification.symbol ? `/square/${notification.symbol}` : "/square/notifications",
          }
        : {
            id: notification.id,
            title: notification.actor
              ? `${`${notification.actor.firstName} ${notification.actor.lastName}`.trim() || notification.actor.email} ${COPY[notification.type]}`
              : COPY[notification.type],
            body: notification.post?.body.slice(0, 140) ?? "Open The Square to see it.",
            url: notification.post
              ? `/square/post/${notification.post.id}`
              : notification.actor
                ? `/square/u/${notification.actor.id}`
                : "/square/notifications",
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
            { agent: pushAgent, timeout: 10_000 },
          );
        } catch (error) {
          const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
            return;
          }
          console.error(`Push delivery failed (${endpointHost(subscription.endpoint)}): ${pushFailure(error)}`);
        }
      }),
    );
  } catch (error) {
    console.error("Push delivery error:", error);
  }
}
