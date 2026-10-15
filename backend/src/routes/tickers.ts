import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import { ensureListedTickers } from "../lib/listed-tickers";
import { parseSessionDate, sentimentMap, sentimentWindows, windowStart, type SentimentWindow } from "../lib/sentiment";

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

function cleanSymbol(raw: string) {
  return raw.replace(/^\$/, "").trim().toUpperCase();
}

// GET /api/tickers/watching
tickersRouter.get("/watching", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const watches = await prisma.watch.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      select: { symbol: true, ticker: { select: TICKER_SELECT } },
    });
    res.status(200).json({
      tickers: watches.map(({ ticker }) => {
        const { _count, ...rest } = ticker;
        return { ...rest, postCount: _count.posts };
      }),
    });
  } catch (error) {
    console.error("List watchlist error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tickers/sentiment?symbols=GTCO,ZENITH&window=session&session=2026-10-15
tickersRouter.get("/sentiment", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const raw = typeof req.query.symbols === "string" ? req.query.symbols : "";
    const symbols = raw
      .split(",")
      .map((symbol) => cleanSymbol(symbol))
      .filter((symbol) => /^[A-Z]{2,12}$/.test(symbol));
    const window = req.query.window === "week" || req.query.window === "month" ? req.query.window : "session";
    const session = parseSessionDate(req.query.session);
    const totals = await sentimentMap(symbols, windowStart(window as SentimentWindow, session));
    res.status(200).json({
      window,
      session,
      sentiment: Object.entries(totals).map(([symbol, counts]) => ({ symbol, ...counts })),
    });
  } catch (error) {
    console.error("Ticker sentiment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tickers?limit=10&sector=
tickersRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const sector = typeof req.query.sector === "string" ? req.query.sector.trim() : "";
    await ensureListedTickers();

    const tickers = await prisma.ticker.findMany({
      where: sector ? { sector: { equals: sector, mode: "insensitive" } } : undefined,
      orderBy: [{ posts: { _count: "desc" } }, { symbol: "asc" }],
      take: sector ? MAX_LIMIT : limit,
      select: TICKER_SELECT,
    });

    res.status(200).json({
      tickers: tickers.map(({ _count, ...ticker }) => ({ ...ticker, postCount: _count.posts })),
    });
  } catch (error) {
    console.error("List tickers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function listedTicker(symbol: string) {
  await ensureListedTickers();
  return prisma.ticker.findUnique({ where: { symbol }, select: { symbol: true } });
}

tickersRouter.post("/:symbol/watch", async (req: AuthenticatedRequest<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const symbol = cleanSymbol(req.params.symbol);
    const ticker = await listedTicker(symbol);
    if (!ticker) {
      res.status(404).json({ error: "Ticker not found" });
      return;
    }
    await prisma.watch.upsert({
      where: { userId_symbol: { userId: req.userId!, symbol } },
      create: { userId: req.userId!, symbol },
      update: {},
    });
    res.status(200).json({ watching: true });
  } catch (error) {
    console.error("Watch ticker error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

tickersRouter.delete("/:symbol/watch", async (req: AuthenticatedRequest<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const symbol = cleanSymbol(req.params.symbol);
    await prisma.watch.deleteMany({ where: { userId: req.userId!, symbol } });
    res.status(200).json({ watching: false });
  } catch (error) {
    console.error("Unwatch ticker error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/tickers/:symbol?session=2026-10-15
tickersRouter.get("/:symbol", async (req: AuthenticatedRequest<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const symbol = cleanSymbol(req.params.symbol);
    const ticker = await prisma.ticker.findUnique({ where: { symbol }, select: TICKER_SELECT });
    if (!ticker) {
      res.status(404).json({ error: "Ticker not found" });
      return;
    }

    const session = parseSessionDate(req.query.session);
    const [sentiment, watched] = await Promise.all([
      sentimentWindows(symbol, session),
      prisma.watch.findUnique({
        where: { userId_symbol: { userId: req.userId!, symbol } },
        select: { userId: true },
      }),
    ]);

    const { _count, ...rest } = ticker;
    res.status(200).json({
      ticker: {
        ...rest,
        postCount: _count.posts,
        watchedByMe: !!watched,
        bulls: sentiment.session.bulls,
        bears: sentiment.session.bears,
        sentiment,
      },
    });
  } catch (error) {
    console.error("Get ticker error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
