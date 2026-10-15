import { Router, Response } from "express";
import { NotificationType, Prisma, Stance } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { listPosts, listReposts, pageSize, pollInclude, postInclude, toPollDto, toPostDto } from "../lib/post";
import { notify, unnotify } from "../lib/notify";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import { InteractionError, assertCanInteract, blockedAuthorIds, hiddenAuthorIds } from "../lib/visibility";

export const postsRouter = Router();

postsRouter.use(authenticateJwt);

const BODY_LIMIT = 280;
// Must match TICKER_RE in frontend/src/components/square/data.ts.
const TICKER_RE = /\$([A-Z]{2,12})/g;

function extractTickers(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(TICKER_RE), (m) => m[1])));
}

type PollOptionInput = { label: string; stance: Stance | null };

function parsePoll(raw: unknown): PollOptionInput[] | null | "invalid" {
  if (raw == null) return null;
  if (typeof raw !== "object" || !Array.isArray((raw as { options?: unknown }).options)) return "invalid";
  const options = (raw as { options: unknown[] }).options;
  if (options.length < 2 || options.length > 4) return "invalid";

  const parsed: PollOptionInput[] = [];
  for (const option of options) {
    if (!option || typeof option !== "object") return "invalid";
    const label = typeof (option as { label?: unknown }).label === "string" ? (option as { label: string }).label.trim() : "";
    const stance = (option as { stance?: unknown }).stance ?? null;
    if (!label || label.length > 40) return "invalid";
    if (stance != null && stance !== Stance.bull && stance !== Stance.bear) return "invalid";
    parsed.push({ label, stance });
  }
  return parsed;
}

// GET /api/posts?ticker=DANGCEM&sector=&feed=following|watchlist&author=<userId>&likedBy=<userId>&repostedBy=<userId>&replies=1&cursor=<postId>&limit=50
postsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { ticker, sector, feed, author, likedBy, repostedBy, replies, cursor } = req.query;
    if (typeof repostedBy === "string" && repostedBy) {
      res.status(200).json(await listReposts(userId, repostedBy, { cursor, limit: pageSize(req.query.limit) }));
      return;
    }
    const repliesOnly = replies === "1" || replies === "true";

    const where: Prisma.PostWhereInput = {};
    if (typeof likedBy === "string" && likedBy) {
      where.likes = { some: { userId: likedBy } };
    } else if (repliesOnly) {
      where.parentId = { not: null };
    } else {
      where.parentId = null;
    }
    if (typeof ticker === "string" && ticker) {
      where.tickers = { some: { symbol: ticker.replace(/^\$/, "").toUpperCase() } };
    } else if (typeof sector === "string" && sector.trim()) {
      where.tickers = { some: { sector: { equals: sector.trim(), mode: "insensitive" } } };
    } else if (feed === "watchlist") {
      where.tickers = { some: { watches: { some: { userId } } } };
    }
    if (typeof author === "string" && author) {
      where.authorId = author;
    }
    if (feed === "following") {
      where.OR = [{ authorId: userId }, { author: { followers: { some: { followerId: userId } } } }];
    }

    const hidden = await hiddenAuthorIds(userId);
    const visible = hidden.length ? { AND: [where, { authorId: { notIn: hidden } }] } : where;
    res.status(200).json(await listPosts(userId, visible, { cursor, limit: pageSize(req.query.limit) }));
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
    const quoteId = typeof req.body?.quoteId === "string" ? req.body.quoteId : null;
    const poll = parsePoll(req.body?.poll);
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
    if (poll === "invalid") {
      res.status(400).json({ error: "A poll needs 2 to 4 options, each 40 characters or fewer" });
      return;
    }
    if (parentId && quoteId) {
      res.status(400).json({ error: "A reply can't also quote a post" });
      return;
    }
    if (parentId && poll) {
      res.status(400).json({ error: "A reply can't include a poll" });
      return;
    }

    const parent = parentId
      ? await prisma.post.findUnique({ where: { id: parentId }, select: { id: true, authorId: true } })
      : null;
    if (parentId && !parent) {
      res.status(404).json({ error: "The post you're replying to no longer exists" });
      return;
    }

    const quoted = quoteId
      ? await prisma.post.findUnique({
          where: { id: quoteId },
          select: { id: true, authorId: true, tickers: { select: { symbol: true } } },
        })
      : null;
    if (quoteId && !quoted) {
      res.status(404).json({ error: "The post you're quoting no longer exists" });
      return;
    }

    try {
      if (parent) await assertCanInteract(userId, parent.authorId);
      if (quoted) await assertCanInteract(userId, quoted.authorId);
    } catch (error) {
      if (error instanceof InteractionError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }

    const symbols = Array.from(new Set([...extractTickers(text), ...(quoted?.tickers.map((ticker) => ticker.symbol) ?? [])]));
    const post = await prisma.post.create({
      data: {
        body: text,
        stance: (stance as Stance | null | undefined) ?? null,
        authorId: userId,
        parentId: parent?.id ?? null,
        quoteId: quoted?.id ?? null,
        tickers: {
          connectOrCreate: symbols.map((symbol) => ({
            where: { symbol },
            create: { symbol },
          })),
        },
        ...(poll
          ? {
              poll: {
                create: {
                  options: {
                    create: poll.map((option, position) => ({
                      label: option.label,
                      stance: option.stance,
                      position,
                    })),
                  },
                },
              },
            }
          : {}),
      },
      include: postInclude(userId),
    });

    if (parent) {
      await notify({ type: NotificationType.reply, actorId: userId, recipientId: parent.authorId, postId: post.id });
    }
    if (quoted) {
      await notify({ type: NotificationType.quote, actorId: userId, recipientId: quoted.authorId, postId: post.id });
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

    if (!post || (await blockedAuthorIds(userId)).includes(post.authorId)) {
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
    const userId = req.userId!;
    const hidden = await hiddenAuthorIds(userId);
    res.status(200).json(
      await listPosts(
        userId,
        { parentId: req.params.id, ...(hidden.length ? { authorId: { notIn: hidden } } : {}) },
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
      if (!post || (await blockedAuthorIds(userId)).includes(post.authorId)) {
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

// POST /api/posts/:id/vote — one vote per person; voting again moves it
postsRouter.post("/:id/vote", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const optionId = typeof req.body?.optionId === "string" ? req.body.optionId : "";
    if (!optionId) {
      res.status(400).json({ error: "Choose an option" });
      return;
    }

    const poll = await prisma.poll.findUnique({
      where: { postId: req.params.id },
      select: { id: true, options: { select: { id: true } }, post: { select: { authorId: true } } },
    });
    if (!poll || !poll.options.some((option) => option.id === optionId)) {
      res.status(404).json({ error: "That poll option no longer exists" });
      return;
    }

    try {
      await assertCanInteract(userId, poll.post.authorId);
    } catch (error) {
      if (error instanceof InteractionError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      await tx.pollVote.deleteMany({ where: { userId, pollId: poll.id } });
      await tx.pollVote.create({ data: { userId, pollId: poll.id, optionId } });
    });

    const fresh = await prisma.poll.findUniqueOrThrow({
      where: { id: poll.id },
      include: pollInclude(userId),
    });
    res.status(200).json({ poll: toPollDto(fresh) });
  } catch (error) {
    console.error("Vote error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
