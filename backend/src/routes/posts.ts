import { Router, Response } from "express";
import { NotificationType, Prisma, Stance } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { listPosts, pageSize, postInclude, toPostDto } from "../lib/post";
import { notify, unnotify } from "../lib/notify";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const postsRouter = Router();

postsRouter.use(authenticateJwt);

const BODY_LIMIT = 280;
// Must match TICKER_RE in frontend/src/components/square/data.ts.
const TICKER_RE = /\$([A-Z]{2,12})/g;

function extractTickers(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(TICKER_RE), (m) => m[1])));
}

// GET /api/posts?ticker=DANGCEM&feed=following&author=<userId>&likedBy=<userId>&cursor=<postId>&limit=50
postsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { ticker, feed, author, likedBy, cursor } = req.query;

    const where: Prisma.PostWhereInput = {};
    if (typeof likedBy === "string" && likedBy) {
      where.likes = { some: { userId: likedBy } };
    } else {
      where.parentId = null;
    }
    if (typeof ticker === "string" && ticker) {
      where.tickers = { some: { symbol: ticker.replace(/^\$/, "").toUpperCase() } };
    }
    if (typeof author === "string" && author) {
      where.authorId = author;
    }
    if (feed === "following") {
      where.OR = [{ authorId: userId }, { author: { followers: { some: { followerId: userId } } } }];
    }

    res.status(200).json(await listPosts(userId, where, { cursor, limit: pageSize(req.query.limit) }));
  } catch (error) {
    console.error("List posts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/posts
postsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { body, stance, parentId } = req.body ?? {};
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

    if (parentId != null && typeof parentId !== "string") {
      res.status(400).json({ error: "parentId must be a string" });
      return;
    }

    const parent = parentId
      ? await prisma.post.findUnique({ where: { id: parentId }, select: { id: true, authorId: true } })
      : null;
    if (parentId && !parent) {
      res.status(404).json({ error: "The post you're replying to no longer exists" });
      return;
    }

    const post = await prisma.post.create({
      data: {
        body: text,
        stance: (stance as Stance | null | undefined) ?? null,
        authorId: userId,
        parentId: parent?.id ?? null,
        tickers: {
          connectOrCreate: extractTickers(text).map((symbol) => ({
            where: { symbol },
            create: { symbol },
          })),
        },
      },
      include: postInclude(userId),
    });

    if (parent) {
      await notify({ type: NotificationType.reply, actorId: userId, recipientId: parent.authorId, postId: post.id });
    }

    res.status(201).json({ post: toPostDto(post) });
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/posts/:id — the post plus the post it replies to, if any
postsRouter.get("/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: postInclude(userId) });

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const parent = post.parentId
      ? await prisma.post.findUnique({ where: { id: post.parentId }, include: postInclude(userId) })
      : null;

    res.status(200).json({ post: toPostDto(post), parent: parent ? toPostDto(parent) : null });
  } catch (error) {
    console.error("Get post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/posts/:id/replies?cursor=<postId>&limit=50 — oldest first
postsRouter.get("/:id/replies", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    res
      .status(200)
      .json(
        await listPosts(
          req.userId!,
          { parentId: req.params.id },
          { cursor: req.query.cursor, limit: pageSize(req.query.limit), order: "asc" },
        ),
      );
  } catch (error) {
    console.error("List replies error:", error);
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

/* Likes, reposts and bookmarks                                         */
/* ------------------------------------------------------------------ */

type Reaction = "like" | "repost" | "bookmark";

const REACTION_NOTIFICATION: Partial<Record<Reaction, NotificationType>> = {
  like: NotificationType.like,
  repost: NotificationType.repost,
};

// Returns whether the state actually changed, so repeat requests don't duplicate notifications.
async function setReaction(kind: Reaction, userId: string, postId: string, on: boolean): Promise<boolean> {
  const data = { userId, postId };
  switch (kind) {
    case "like":
      return on
        ? (await prisma.like.createMany({ data, skipDuplicates: true })).count > 0
        : (await prisma.like.deleteMany({ where: data })).count > 0;
    case "repost":
      return on
        ? (await prisma.repost.createMany({ data, skipDuplicates: true })).count > 0
        : (await prisma.repost.deleteMany({ where: data })).count > 0;
    case "bookmark":
      return on
        ? (await prisma.bookmark.createMany({ data, skipDuplicates: true })).count > 0
        : (await prisma.bookmark.deleteMany({ where: data })).count > 0;
  }
}

function countReaction(kind: Reaction, postId: string): Promise<number> {
  switch (kind) {
    case "like":
      return prisma.like.count({ where: { postId } });
    case "repost":
      return prisma.repost.count({ where: { postId } });
    case "bookmark":
      return prisma.bookmark.count({ where: { postId } });
  }
}

function reactionHandler(kind: Reaction, on: boolean) {
  return async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const postId = req.params.id;

      const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
      if (!post) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      const changed = await setReaction(kind, userId, postId, on);
      const type = REACTION_NOTIFICATION[kind];
      if (changed && type) {
        const args = { type, actorId: userId, recipientId: post.authorId, postId };
        await (on ? notify(args) : unnotify(args));
      }

      res.status(200).json({ active: on, count: await countReaction(kind, postId) });
    } catch (error) {
      console.error(`${on ? "Add" : "Remove"} ${kind} error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

for (const kind of ["like", "repost", "bookmark"] as const) {
  postsRouter.post(`/:id/${kind}`, reactionHandler(kind, true));
  postsRouter.delete(`/:id/${kind}`, reactionHandler(kind, false));
}
