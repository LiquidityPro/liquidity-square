import { prisma } from "./prisma";
import { deliverPush } from "./push";
import { getFilingHistory, getFilings, type FilingNotice } from "./ngx-filings";
import { notificationSelect, toNotificationDto } from "./notification-dto";
import { publishLiveNotification } from "./live-publish";

const UNREAD_NUDGE = 5;
const SWEEP_GAP_MS = 60_000;
const POLL_MS = 5 * 60 * 1000;
const LIST_LIMIT = 200;
const WINDOWS = new Set([7, 30, 183]);

let lastSweepAt = 0;
let sweeping: Promise<{ delivered: number }> | null = null;
let pollerStarted = false;

const NUDGE_SUMMARY = "New filings are on the NGX. See the latest.";
const NUDGE_HREF = "/square/notifications?tab=filings";

function clip(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

async function upsertFilings(filings: FilingNotice[]) {
  if (filings.length === 0) return;
  await prisma.filing.createMany({
    data: filings.map((filing) => ({
      key: filing.key,
      symbol: clip(filing.symbol, 12),
      label: clip(filing.label, 40) || "Filing",
      title: clip(filing.title, 300) || filing.symbol,
      url: clip(filing.url, 500),
      filedAt: filing.filedAt,
    })),
    skipDuplicates: true,
  });
}

async function catalog(supplied: FilingNotice[]) {
  const history = await getFilingHistory().catch((error) => {
    console.error("NGX filing history unavailable", error);
    return supplied;
  });
  const byKey = new Map<string, FilingNotice>();
  for (const filing of [...history, ...supplied]) byKey.set(filing.key, filing);
  return [...byKey.values()].sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime());
}

/** People who have not opened Filings yet start caught up, so the back catalog is not a pile of alerts. */
async function catchUpNewReaders(newest: Date) {
  await prisma.user.updateMany({
    where: { filingsSeenAt: null },
    data: { filingsSeenAt: newest },
  });
}

async function sendNudge(userId: string) {
  const claimed = await prisma.user.updateMany({
    where: { id: userId, filingNudgeAt: null },
    data: { filingNudgeAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  const notification = await prisma.notification.create({
    data: {
      type: "filings",
      recipientId: userId,
      summary: NUDGE_SUMMARY,
      href: NUDGE_HREF,
    },
    select: notificationSelect,
  });
  await deliverPush(notification.id);
  await publishLiveNotification(userId, toNotificationDto(notification)).catch((error) =>
    console.error("Live filings nudge failed", error),
  );
  return true;
}

async function nudgeReadyUsers() {
  const ready = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u.id
    FROM "users" u
    WHERE u."filingsSeenAt" IS NOT NULL
      AND u."filingNudgeAt" IS NULL
      AND (
        SELECT COUNT(*)
        FROM "filings" f
        WHERE f."filedAt" > u."filingsSeenAt"
      ) >= ${UNREAD_NUDGE}
  `;

  let delivered = 0;
  for (const user of ready) {
    if (await sendNudge(user.id)) delivered += 1;
  }
  return delivered;
}

async function storeAndNudge(supplied: FilingNotice[]) {
  const filings = await catalog(supplied);
  if (filings.length === 0) return { delivered: 0 };
  await upsertFilings(filings);
  const delivered = await nudgeReadyUsers();
  await catchUpNewReaders(filings[0].filedAt);
  return { delivered };
}

export async function syncDisclosures(userId: string) {
  const filings = await getFilingHistory().catch(() => getFilings());
  await storeAndNudge(filings);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { filingsSeenAt: true } });
  if (user && !user.filingsSeenAt && filings[0]) {
    await prisma.user.update({ where: { id: userId }, data: { filingsSeenAt: filings[0].filedAt } });
  }
  return { delivered: 0, notifications: [] as [] };
}

export async function sweepDisclosures(filings: FilingNotice[]) {
  const now = Date.now();
  if (sweeping) return sweeping;
  if (now - lastSweepAt < SWEEP_GAP_MS && filings.length === 0) return { delivered: 0 };

  sweeping = storeAndNudge(filings).finally(() => {
    sweeping = null;
    lastSweepAt = Date.now();
  });
  return sweeping;
}

export function startDisclosurePoller() {
  if (pollerStarted) return;
  pollerStarted = true;
  const tick = () => {
    getFilingHistory()
      .then((filings) => sweepDisclosures(filings))
      .catch((error) => console.error("Disclosure poll failed", error));
  };
  setTimeout(tick, 15_000);
  setInterval(tick, POLL_MS);
}

export function filingWindow(raw: unknown) {
  const days = Number(raw);
  return WINDOWS.has(days) ? days : 7;
}

export async function listFilings(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.filing.findMany({
    where: { filedAt: { gte: since } },
    orderBy: { filedAt: "desc" },
    take: LIST_LIMIT,
    select: { id: true, symbol: true, label: true, title: true, url: true, filedAt: true },
  });
}

export async function markFilingsSeen(userId: string) {
  await prisma.user.updateMany({
    where: { id: userId },
    data: { filingsSeenAt: new Date(), filingNudgeAt: null },
  });
}
