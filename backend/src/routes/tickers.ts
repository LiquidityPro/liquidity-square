import { Router, Request, Response } from "express";
import { Stance } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticateJwt } from "../middleware/auth";
import { ensureListedTickers } from "../lib/listed-tickers";

export const tickersRouter = Router();

tickersRouter.use(authenticateJwt);

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const TICKER_SELECT = {
  symbol: true,
  name: true,
  sector: true,
  _count: { select: { posts: true } },
} as const;

// GET /api/tickers?limit=10 — most-discussed first
tickersRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    await ensureListedTickers();

    const tickers = await prisma.ticker.findMany({
      orderBy: [{ posts: { _count: "desc" } }, { symbol: "asc" }],
      take: limit,
      select: TICKER_SELECT,
    });

    res.status(200).json({
      tickers: tickers.map(({ _count, ...t }) => ({ ...t, postCount: _count.posts })),
    });
  } catch (error) {
    console.error("List tickers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tickers/:symbol
tickersRouter.get("/:symbol", async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const symbol = req.params.symbol.replace(/^\$/, "").toUpperCase();

    const ticker = await prisma.ticker.findUnique({ where: { symbol }, select: TICKER_SELECT });
    if (!ticker) {
      res.status(404).json({ error: "Ticker not found" });
      return;
    }

    const onTicker = { tickers: { some: { symbol } } };
    const [bulls, bears] = await Promise.all([
      prisma.post.count({ where: { ...onTicker, stance: Stance.bull } }),
      prisma.post.count({ where: { ...onTicker, stance: Stance.bear } }),
    ]);

    const { _count, ...rest } = ticker;
    res.status(200).json({ ticker: { ...rest, postCount: _count.posts, bulls, bears } });
  } catch (error) {
    console.error("Get ticker error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
