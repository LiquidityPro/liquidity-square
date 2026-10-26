import { AlertDirection } from "@prisma/client";
import { prisma } from "./prisma";
import { notificationSelect, toNotificationDto } from "./notification-dto";
import { publishLiveNotification } from "./live-publish";
import { deliverPush } from "./push";

export type SweepQuote = { symbol: string; changePct: number };

const MIN_THRESHOLD = 0.5;
const MAX_THRESHOLD = 50;
const SWEEP_GAP_MS = 60_000;

let lastSweepAt = 0;
let sweeping: Promise<{ fired: number; skipped: boolean }> | null = null;

export function cleanThreshold(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  if (rounded < MIN_THRESHOLD || rounded > MAX_THRESHOLD) return null;
  return rounded;
}

export function cleanDirection(raw: unknown): AlertDirection | null {
  if (raw == null || raw === "") return AlertDirection.either;
  if (raw === AlertDirection.up || raw === AlertDirection.down || raw === AlertDirection.either) return raw;
  return null;
}

export function alertHits(direction: AlertDirection, thresholdPct: number, changePct: number) {
  if (direction === AlertDirection.up) return changePct >= thresholdPct;
  if (direction === AlertDirection.down) return changePct <= -thresholdPct;
  return Math.abs(changePct) >= thresholdPct;
}

function summary(symbol: string, changePct: number) {
  const side = changePct >= 0 ? "up" : "down";
  return `$${symbol} is ${side} ${Math.abs(changePct).toFixed(2)}% this session`;
}

export async function sweepAlerts(sessionDate: string, quotes: SweepQuote[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return { fired: 0, skipped: true };
  const now = Date.now();
  if (sweeping) return sweeping;
  if (now - lastSweepAt < SWEEP_GAP_MS) return { fired: 0, skipped: true };

  sweeping = runSweep(sessionDate, quotes).finally(() => {
    sweeping = null;
    lastSweepAt = Date.now();
  });
  return sweeping;
}

async function runSweep(sessionDate: string, quotes: SweepQuote[]) {
  const bySymbol = new Map<string, number>();
  for (const quote of quotes) {
    const symbol = quote.symbol?.trim().toUpperCase();
    if (!symbol || !Number.isFinite(quote.changePct)) continue;
    bySymbol.set(symbol, quote.changePct);
  }
  if (bySymbol.size === 0) return { fired: 0, skipped: false };

  const alerts = await prisma.priceAlert.findMany({
    where: {
      symbol: { in: Array.from(bySymbol.keys()) },
      OR: [{ lastFiredSession: null }, { lastFiredSession: { not: sessionDate } }],
    },
  });

  let fired = 0;
  for (const alert of alerts) {
    const changePct = bySymbol.get(alert.symbol);
    if (changePct == null || !alertHits(alert.direction, alert.thresholdPct, changePct)) continue;

    const claimed = await prisma.priceAlert.updateMany({
      where: {
        userId: alert.userId,
        symbol: alert.symbol,
        OR: [{ lastFiredSession: null }, { lastFiredSession: { not: sessionDate } }],
      },
      data: { lastFiredSession: sessionDate },
    });
    if (claimed.count === 0) continue;

    try {
      const notification = await prisma.notification.create({
        data: {
          type: "alert",
          recipientId: alert.userId,
          symbol: alert.symbol,
          summary: summary(alert.symbol, changePct).slice(0, 180),
        },
        select: notificationSelect,
      });
      await deliverPush(notification.id);
      await publishLiveNotification(alert.userId, toNotificationDto(notification)).catch((error) =>
        console.error("Live alert failed", error),
      );
      fired += 1;
    } catch (error) {
      console.error("Price alert delivery error:", error);
    }
  }

  return { fired, skipped: false };
}
