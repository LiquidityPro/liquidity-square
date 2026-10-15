import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import { ensureListedTickers } from "../lib/listed-tickers";
import { cleanDirection, cleanThreshold, sweepAlerts, type SweepQuote } from "../lib/alerts";

export const alertsRouter = Router();

function sweepAllowed(req: AuthenticatedRequest) {
  const secret = process.env.ALERT_SWEEP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.get("x-sweep-key") === secret;
}

// POST /api/alerts/sweep — called by the tape route after a fresh NGX session
alertsRouter.post("/sweep", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!sweepAllowed(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const sessionDate = typeof req.body?.sessionDate === "string" ? req.body.sessionDate : "";
    const quotes = Array.isArray(req.body?.quotes) ? (req.body.quotes as SweepQuote[]) : [];
    const result = await sweepAlerts(sessionDate, quotes);
    res.status(200).json(result);
  } catch (error) {
    console.error("Sweep alerts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

alertsRouter.use(authenticateJwt);

function cleanSymbol(raw: string) {
  return raw.replace(/^\$/, "").trim().toUpperCase();
}

alertsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const symbol = typeof req.query.symbol === "string" ? cleanSymbol(req.query.symbol) : "";
    const alerts = await prisma.priceAlert.findMany({
      where: { userId: req.userId!, ...(symbol ? { symbol } : {}) },
      orderBy: { symbol: "asc" },
      select: { symbol: true, thresholdPct: true, direction: true },
    });
    res.status(200).json({ alerts });
  } catch (error) {
    console.error("List alerts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

alertsRouter.put("/:symbol", async (req: AuthenticatedRequest<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const symbol = cleanSymbol(req.params.symbol);
    const thresholdPct = cleanThreshold(req.body?.thresholdPct);
    const direction = cleanDirection(req.body?.direction);
    if (thresholdPct == null || !direction) {
      res.status(400).json({ error: "Set a move between 0.5% and 50%, and a direction" });
      return;
    }

    await ensureListedTickers();
    const ticker = await prisma.ticker.findUnique({ where: { symbol }, select: { symbol: true } });
    if (!ticker) {
      res.status(404).json({ error: "Ticker not found" });
      return;
    }

    const alert = await prisma.priceAlert.upsert({
      where: { userId_symbol: { userId: req.userId!, symbol } },
      create: { userId: req.userId!, symbol, thresholdPct, direction },
      update: { thresholdPct, direction, lastFiredSession: null },
      select: { symbol: true, thresholdPct: true, direction: true },
    });
    res.status(200).json({ alert });
  } catch (error) {
    console.error("Save alert error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

alertsRouter.delete("/:symbol", async (req: AuthenticatedRequest<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const symbol = cleanSymbol(req.params.symbol);
    await prisma.priceAlert.deleteMany({ where: { userId: req.userId!, symbol } });
    res.status(204).end();
  } catch (error) {
    console.error("Delete alert error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
