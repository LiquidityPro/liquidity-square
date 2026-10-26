import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { deliverPush } from "./push";
import { getFilings, type FilingNotice } from "./ngx-filings";
import { notificationSelect, toNotificationDto } from "./notification-dto";
import { publishLiveNotification } from "./live-publish";

const CATCH_UP = 5;
const SWEEP_GAP_MS = 60_000;
const POLL_MS = 5 * 60 * 1000;

let lastSweepAt = 0;
let sweeping: Promise<{ delivered: number }> | null = null;
let pollerStarted = false;

function summary(filing: FilingNotice) {
  return `$${filing.symbol} · ${filing.title}`.replace(/\s+/g, " ").trim().slice(0, 180);
}

async function deliverFiling(userId: string, filing: FilingNotice) {
  try {
    await prisma.disclosureReceipt.create({
      data: { userId, filingKey: filing.key, filedAt: filing.filedAt },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }

  const notification = await prisma.notification.create({
    data: {
      type: "disclosure",
      recipientId: userId,
      symbol: filing.symbol,
      summary: summary(filing),
      href: filing.url.slice(0, 500),
    },
    select: notificationSelect,
  });
  await deliverPush(notification.id);
  const dto = toNotificationDto(notification);
  await publishLiveNotification(userId, dto).catch((error) => console.error("Live disclosure failed", error));
  return dto;
}

async function deliverMany(userId: string, filings: FilingNotice[]) {
  const created = [];
  for (const filing of filings) {
    const notification = await deliverFiling(userId, filing);
    if (notification) created.push(notification);
  }
  return created;
}

/** First sign-in receives the latest five filings. Later calls only receive newer ones. */
export async function syncDisclosures(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { disclosureCursor: true },
  });
  if (!user) return { delivered: 0, notifications: [] };

  const filings = await getFilings();
  if (filings.length === 0) return { delivered: 0, notifications: [] };

  if (!user.disclosureCursor) {
    const latest = filings.slice(0, CATCH_UP).slice().reverse();
    const notifications = await deliverMany(userId, latest);
    await prisma.user.updateMany({
      where: { id: userId, disclosureCursor: null },
      data: { disclosureCursor: filings[0].filedAt },
    });
    return { delivered: notifications.length, notifications };
  }

  const fresh = filings.filter((filing) => filing.filedAt > user.disclosureCursor!).reverse();
  const notifications = await deliverMany(userId, fresh);
  if (filings[0].filedAt > user.disclosureCursor) {
    await prisma.user.update({
      where: { id: userId },
      data: { disclosureCursor: filings[0].filedAt },
    });
  }
  return { delivered: notifications.length, notifications };
}

export async function sweepDisclosures(filings: FilingNotice[]) {
  const now = Date.now();
  if (sweeping) return sweeping;
  if (filings.length === 0 || now - lastSweepAt < SWEEP_GAP_MS) return { delivered: 0 };

  sweeping = runSweep(filings).finally(() => {
    sweeping = null;
    lastSweepAt = Date.now();
  });
  return sweeping;
}

async function runSweep(filings: FilingNotice[]) {
  const newest = filings[0].filedAt;
  const users = await prisma.user.findMany({
    where: { disclosureCursor: { not: null, lt: newest } },
    select: { id: true, disclosureCursor: true },
  });

  let delivered = 0;
  for (const user of users) {
    const cursor = user.disclosureCursor!;
    const fresh = filings.filter((filing) => filing.filedAt > cursor).reverse();
    const created = await deliverMany(user.id, fresh);
    delivered += created.length;
    await prisma.user.update({
      where: { id: user.id },
      data: { disclosureCursor: newest },
    });
  }
  return { delivered };
}

export function startDisclosurePoller() {
  if (pollerStarted) return;
  pollerStarted = true;
  const tick = () => {
    getFilings()
      .then((filings) => sweepDisclosures(filings))
      .catch((error) => console.error("Disclosure poll failed", error));
  };
  setTimeout(tick, 15_000);
  setInterval(tick, POLL_MS);
}
