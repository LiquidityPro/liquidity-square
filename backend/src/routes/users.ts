import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.use(authenticateJwt);

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

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId },
      update: {},
    });

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
    const followingId = req.params.id;

    await prisma.follow.deleteMany({ where: { followerId: req.userId!, followingId } });

    const followers = await prisma.follow.count({ where: { followingId } });
    res.status(200).json({ following: false, followers });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
