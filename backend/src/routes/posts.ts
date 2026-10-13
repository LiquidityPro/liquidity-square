import { Router, Response } from "express";
import { Prisma, Stance } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const postsRouter = Router();

postsRouter.use(authenticateJwt);

const BODY_LIMIT = 280;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
// Must match TICKER_RE in frontend/src/components/square/data.ts.
const TICKER_RE = /\$([A-Z]{2,12})/g;

function extractTickers(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(TICKER_RE), (m) => m[1])));
}

function postInclude(userId: string) {
  return {
    author: { select: AUTHOR_SELECT },
    tickers: { select: { symbol: true } },
    likes: { where: { userId }, select: { userId: true } },
    _count: { select: { likes: true } },
  } satisfies Prisma.PostInclude;
}

type PostWithRelations = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

function toPostDto(post: PostWithRelations) {
  return {
    id: post.id,
    author: toAuthorDto(post.author),
    body: post.body,
    stance: post.stance,
    tickers: post.tickers.map((t) => t.symbol),
    likes: post._count.likes,
    likedByMe: post.likes.length > 0,
    createdAt: post.createdAt.toISOString(),
  };
}

// GET /api/posts?ticker=DANGCEM&feed=following&cursor=<postId>&limit=50
postsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { ticker, feed, cursor } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const where: Prisma.PostWhereInput = {};
    if (typeof ticker === "string" && ticker) {
      where.tickers = { some: { symbol: ticker.replace(/^\$/, "").toUpperCase() } };
    }
    if (feed === "following") {
      where.OR = [{ authorId: userId }, { author: { followers: { some: { followerId: userId } } } }];
    }

    const posts = await prisma.post.findMany({
      where,
      include: postInclude(userId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(typeof cursor === "string" && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const page = posts.slice(0, limit);
    res.status(200).json({
      posts: page.map(toPostDto),
      nextCursor: posts.length > limit ? page[page.length - 1].id : null,
    });
  } catch (error) {
    console.error("List posts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/posts
postsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { body, stance } = req.body ?? {};
    const text = typeof body === "string" ? body.trim() : "";

    if (!text) {
      res.status(400).json({ error: "Post body is required" });
      return;
    }

    if (text.length > BODY_LIMIT) {
      res.status(400).json({ error: `Posts are limited to ${BODY_LIMIT} characters` });
      return;
    }

    if (stance != null && stance !== Stance.bull && stance !== Stance.bear) {
      res.status(400).json({ error: 'Stance must be "bull", "bear" or null' });
      return;
    }

    const post = await prisma.post.create({
      data: {
        body: text,
        stance: (stance as Stance | null | undefined) ?? null,
        authorId: userId,
        tickers: {
          connectOrCreate: extractTickers(text).map((symbol) => ({
            where: { symbol },
            create: { symbol },
          })),
        },
      },
      include: postInclude(userId),
    });

    res.status(201).json({ post: toPostDto(post) });
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/posts/:id
postsRouter.delete("/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { authorId: true },
    });

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    if (post.authorId !== req.userId) {
      res.status(403).json({ error: "You can only delete your own posts" });
      return;
    }

    await prisma.post.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function postExists(id: string): Promise<boolean> {
  return (await prisma.post.count({ where: { id } })) > 0;
}

// POST /api/posts/:id/like
postsRouter.post("/:id/like", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const postId = req.params.id;

    if (!(await postExists(postId))) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    await prisma.like.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });

    const likes = await prisma.like.count({ where: { postId } });
    res.status(200).json({ liked: true, likes });
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/posts/:id/like
postsRouter.delete("/:id/like", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const postId = req.params.id;

    if (!(await postExists(postId))) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    await prisma.like.deleteMany({ where: { userId, postId } });

    const likes = await prisma.like.count({ where: { postId } });
    res.status(200).json({ liked: false, likes });
  } catch (error) {
    console.error("Unlike post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
