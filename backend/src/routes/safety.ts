import { Router, Response } from "express";
import { Prisma, ReportReason } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";

export const safetyRouter = Router();

safetyRouter.use(authenticateJwt);

const REASONS = new Set<string>(Object.values(ReportReason));

async function person(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { id: true } });
}

safetyRouter.get("/muted", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.mute.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      select: { muted: { select: AUTHOR_SELECT } },
    });
    res.status(200).json({ users: rows.map((row) => toAuthorDto(row.muted)) });
  } catch (error) {
    console.error("List muted error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

safetyRouter.get("/blocked", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.block.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      select: { blocked: { select: AUTHOR_SELECT } },
    });
    res.status(200).json({ users: rows.map((row) => toAuthorDto(row.blocked)) });
  } catch (error) {
    console.error("List blocked error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

safetyRouter.post("/mute/:userId", async (req: AuthenticatedRequest<{ userId: string }>, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const mutedId = req.params.userId;
    if (userId === mutedId) {
      res.status(400).json({ error: "You can't mute yourself" });
      return;
    }
    if (!(await person(mutedId))) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await prisma.mute.upsert({
      where: { userId_mutedId: { userId, mutedId } },
      create: { userId, mutedId },
      update: {},
    });
    res.status(200).json({ muted: true });
  } catch (error) {
    console.error("Mute error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

safetyRouter.delete("/mute/:userId", async (req: AuthenticatedRequest<{ userId: string }>, res: Response): Promise<void> => {
  try {
    await prisma.mute.deleteMany({ where: { userId: req.userId!, mutedId: req.params.userId } });
    res.status(200).json({ muted: false });
  } catch (error) {
    console.error("Unmute error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

safetyRouter.post("/block/:userId", async (req: AuthenticatedRequest<{ userId: string }>, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const blockedId = req.params.userId;
    if (userId === blockedId) {
      res.status(400).json({ error: "You can't block yourself" });
      return;
    }
    if (!(await person(blockedId))) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await prisma.$transaction([
      prisma.block.upsert({
        where: { userId_blockedId: { userId, blockedId } },
        create: { userId, blockedId },
        update: {},
      }),
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followingId: blockedId },
            { followerId: blockedId, followingId: userId },
          ],
        },
      }),
      prisma.mute.deleteMany({
        where: {
          OR: [
            { userId, mutedId: blockedId },
            { userId: blockedId, mutedId: userId },
          ],
        },
      }),
    ]);
    res.status(200).json({ blocked: true });
  } catch (error) {
    console.error("Block error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

safetyRouter.delete("/block/:userId", async (req: AuthenticatedRequest<{ userId: string }>, res: Response): Promise<void> => {
  try {
    await prisma.block.deleteMany({ where: { userId: req.userId!, blockedId: req.params.userId } });
    res.status(200).json({ blocked: false });
  } catch (error) {
    console.error("Unblock error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

safetyRouter.post("/reports", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 280) : "";
    const postId = typeof req.body?.postId === "string" ? req.body.postId : null;
    const userId = typeof req.body?.userId === "string" ? req.body.userId : null;

    if (!REASONS.has(reason)) {
      res.status(400).json({ error: "Choose a reason" });
      return;
    }
    if (!postId && !userId) {
      res.status(400).json({ error: "Say what you are reporting" });
      return;
    }
    if (userId === req.userId) {
      res.status(400).json({ error: "You can't report yourself" });
      return;
    }
    if (postId && !(await prisma.post.findUnique({ where: { id: postId }, select: { id: true } }))) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (userId && !(await person(userId))) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await prisma.report.create({
      data: {
        reporterId: req.userId!,
        reason: reason as ReportReason,
        note: note || null,
        postId,
        userId,
      },
    });
    res.status(201).json({ reported: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      res.status(400).json({ error: "Couldn't file that report" });
      return;
    }
    console.error("Report error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
