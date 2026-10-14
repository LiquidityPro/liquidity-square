import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { listPosts } from "../lib/post";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import { ensureListedTickers } from "../lib/listed-tickers";

export const searchRouter = Router();

searchRouter.use(authenticateJwt);

const RESULT_LIMIT = 20;
const MAX_QUERY_LENGTH = 100;

// GET /api/search?q=dangote — tickers, people and posts matching the query
searchRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, MAX_QUERY_LENGTH) : "";
    if (!q) {
      res.status(200).json({ tickers: [], users: [], posts: [] });
      return;
    }

    await ensureListedTickers();

    const symbol = q.replace(/^\$/, "").toUpperCase();
    const contains = { contains: q, mode: "insensitive" } as const;
    const terms = q.split(/\s+/).filter(Boolean);

    const [tickerRows, users, posts] = await Promise.all([
      prisma.ticker.findMany({
        where: { OR: [{ symbol: { contains: symbol } }, { name: contains }] },
        orderBy: [{ posts: { _count: "desc" } }, { symbol: "asc" }],
        take: 40,
        select: { symbol: true, name: true, sector: true, _count: { select: { posts: true } } },
      }),
      prisma.user.findMany({
        where: {
          AND: terms.map((term) => ({
            OR: [
              { firstName: { contains: term, mode: "insensitive" as const } },
              { lastName: { contains: term, mode: "insensitive" as const } },
              { email: { startsWith: term, mode: "insensitive" as const } },
            ],
          })),
        },
        orderBy: { followers: { _count: "desc" } },
        take: RESULT_LIMIT,
        select: AUTHOR_SELECT,
      }),
      listPosts(req.userId!, { body: contains }, { limit: RESULT_LIMIT }),
    ]);

    const tickers = tickerRows
      .map(({ _count, ...t }) => ({ ...t, postCount: _count.posts }))
      .sort(
        (a, b) =>
          Number(!a.symbol.startsWith(symbol)) - Number(!b.symbol.startsWith(symbol)) ||
          b.postCount - a.postCount ||
          a.symbol.localeCompare(b.symbol),
      )
      .slice(0, RESULT_LIMIT);

    res.status(200).json({
      tickers,
      users: users.map(toAuthorDto),
      posts: posts.posts,
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
