import { Router, Response } from "express";
import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { pageSize, postInclude, toPostDto } from "../lib/post";
import { notify, unnotify } from "../lib/notify";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.use(authenticateJwt);

const SUGGESTED_LIMIT = 5;
const MAX_SUGGESTED_LIMIT = 20;

// GET /api/users/me/following
usersRouter.get("/me/following", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const follows = await prisma.follow.findMany({
      where: { followerId: req.userId! },
      orderBy: { createdAt: "desc" },
      select: { following: { select: AUTHOR_SELECT } },
    });

    res.status(200).json({ users: follows.map((f) => toAuthorDto(f.following)) });
  } catch (error) {
    console.error("List following error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/me/bookmarks?cursor=<postId>&limit=50 — most recently bookmarked first
usersRouter.get("/me/bookmarks", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const limit = pageSize(req.query.limit);
    const { cursor } = req.query;

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { postId: "desc" }],
      take: limit + 1,
      ...(typeof cursor === "string" && cursor
        ? { cursor: { userId_postId: { userId, postId: cursor } }, skip: 1 }
        : {}),
      select: { postId: true, post: { include: postInclude(userId) } },
    });

    const page = bookmarks.slice(0, limit);
    res.status(200).json({
      posts: page.map((b) => toPostDto(b.post)),
      nextCursor: bookmarks.length > limit ? page[page.length - 1].postId : null,
    });
  } catch (error) {
    console.error("List bookmarks error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/suggested?limit=5 — most-followed users the caller doesn't follow yet
usersRouter.get("/suggested", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const limit = Math.min(Math.max(Number(req.query.limit) || SUGGESTED_LIMIT, 1), MAX_SUGGESTED_LIMIT);

    const users = await prisma.user.findMany({
      where: { id: { not: userId }, followers: { none: { followerId: userId } } },
      orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
      take: limit,
      select: AUTHOR_SELECT,
    });

    res.status(200).json({ users: users.map(toAuthorDto) });
  } catch (error) {
    console.error("Suggested users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:id — public profile
usersRouter.get("/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const [user, followedByMe] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          ...AUTHOR_SELECT,
          createdAt: true,
          _count: { select: { posts: true, followers: true, following: true } },
        },
      }),
      prisma.follow.count({ where: { followerId: req.userId!, followingId: id } }),
    ]);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { createdAt, _count, ...author } = user;
    res.status(200).json({
      profile: {
        ...toAuthorDto(author),
        joinedAt: createdAt.toISOString(),
        posts: _count.posts,
        followers: _count.followers,
        following: _count.following,
        followedByMe: followedByMe > 0,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/:id/follow
usersRouter.post("/:id/follow", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const followerId = req.userId!;
    const followingId = req.params.id;

    if (followerId === followingId) {
      res.status(400).json({ error: "You can't follow yourself" });
      return;
    }

    const target = await prisma.user.count({ where: { id: followingId } });
    if (target === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { count } = await prisma.follow.createMany({
      data: { followerId, followingId },
      skipDuplicates: true,
    });
    if (count > 0) {
      await notify({ type: NotificationType.follow, actorId: followerId, recipientId: followingId });
    }

    const followers = await prisma.follow.count({ where: { followingId } });
    res.status(200).json({ following: true, followers });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:id/follow
usersRouter.delete("/:id/follow", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const followerId = req.userId!;
    const followingId = req.params.id;

    const { count } = await prisma.follow.deleteMany({ where: { followerId, followingId } });
    if (count > 0) {
      await unnotify({ type: NotificationType.follow, actorId: followerId, recipientId: followingId });
    }

    const followers = await prisma.follow.count({ where: { followingId } });
    res.status(200).json({ following: false, followers });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
