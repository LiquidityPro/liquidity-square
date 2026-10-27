import { ModerationAction, Prisma, ReportStatus } from "@prisma/client";
import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { toAuthorDto, AUTHOR_SELECT } from "../lib/author";
import { authenticateJwt, requireStaff, AuthenticatedRequest } from "../middleware/auth";
import { publishLivePost, publishLiveRemoval } from "../lib/live-publish";
import { disconnectLive } from "../lib/live-hub";
import { postInclude, toPostDto } from "../lib/post";

export const adminRouter = Router();

adminRouter.use(authenticateJwt, requireStaff);

const NOTE_MIN = 3;
const NOTE_MAX = 280;
const PAGE = 40;

const accountSelect = {
  ...AUTHOR_SELECT,
  staff: true,
  suspendedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type AccountRow = Prisma.UserGetPayload<{ select: typeof accountSelect }>;

class DeskError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function accountDto(user: AccountRow) {
  return {
    ...toAuthorDto(user),
    email: user.email,
    staff: user.staff,
    suspendedAt: user.suspendedAt ? user.suspendedAt.toISOString() : null,
    joinedAt: user.createdAt.toISOString(),
  };
}

function cleanNote(body: unknown): { note: string; reportId: string | null } {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const note = typeof record.note === "string" ? record.note.trim() : "";
  if (note.length < NOTE_MIN || note.length > NOTE_MAX) {
    throw new DeskError(`Add a note, from ${NOTE_MIN} to ${NOTE_MAX} characters`, 400);
  }
  const reportId = typeof record.reportId === "string" && record.reportId ? record.reportId : null;
  return { note, reportId };
}

async function closeReport(tx: Prisma.TransactionClient, reportId: string | null) {
  if (!reportId) return;
  const report = await tx.report.findUnique({ where: { id: reportId }, select: { status: true } });
  if (!report) throw new DeskError("Report not found", 404);
  if (report.status !== ReportStatus.open) throw new DeskError("That report is already closed", 409);
  await tx.report.update({
    where: { id: reportId },
    data: { status: ReportStatus.resolved, resolvedAt: new Date() },
  });
}

async function writeEvent(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: ModerationAction,
  note: string,
  reportId: string | null,
  target: { targetUserId?: string | null; targetPostId?: string | null },
) {
  await closeReport(tx, reportId);
  await tx.moderationEvent.create({
    data: {
      actorId,
      action,
      note,
      reportId,
      targetUserId: target.targetUserId ?? null,
      targetPostId: target.targetPostId ?? null,
    },
  });
}

function fail(res: Response, error: unknown, label: string) {
  if (error instanceof DeskError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(label, error);
  res.status(500).json({ error: "Internal server error" });
}

adminRouter.get("/me", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: accountSelect });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.status(200).json({ staff: accountDto(user) });
});

adminRouter.get("/reports", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status === "resolved" ? ReportStatus.resolved : ReportStatus.open;
    const reports = await prisma.report.findMany({
      where: { status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE,
      include: {
        reporter: { select: accountSelect },
        reported: { select: accountSelect },
        post: {
          select: {
            id: true,
            body: true,
            removedAt: true,
            createdAt: true,
            author: { select: accountSelect },
          },
        },
      },
    });
    res.status(200).json({
      reports: reports.map((report) => ({
        id: report.id,
        reason: report.reason,
        note: report.note,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        reporter: accountDto(report.reporter),
        account: report.reported ? accountDto(report.reported) : null,
        post: report.post
          ? {
              id: report.post.id,
              body: report.post.body,
              removedAt: report.post.removedAt ? report.post.removedAt.toISOString() : null,
              createdAt: report.post.createdAt.toISOString(),
              author: accountDto(report.post.author),
            }
          : null,
      })),
    });
  } catch (error) {
    fail(res, error, "List reports error:");
  }
});

adminRouter.get("/accounts", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const terms = q
      .split(/\s+/)
      .map((term) => term.replace(/^@+/, ""))
      .filter(Boolean);
    if (terms.length === 0) {
      res.status(200).json({ accounts: [] });
      return;
    }
    const accounts = await prisma.user.findMany({
      where: {
        AND: terms.map((term) => ({
          OR: [
            { firstName: { contains: term, mode: "insensitive" as const } },
            { lastName: { contains: term, mode: "insensitive" as const } },
            { email: { contains: term, mode: "insensitive" as const } },
            { username: { contains: term, mode: "insensitive" as const } },
          ],
        })),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: accountSelect,
    });
    const needle = terms[terms.length - 1].toLowerCase();
    const rank = (username: string | null) => {
      const handle = (username ?? "").toLowerCase();
      if (handle === needle) return 0;
      if (handle.startsWith(needle)) return 1;
      return 2;
    };
    accounts.sort((a, b) => rank(a.username) - rank(b.username));
    res.status(200).json({ accounts: accounts.map(accountDto) });
  } catch (error) {
    fail(res, error, "Search accounts error:");
  }
});

adminRouter.get("/accounts/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: accountSelect });
    if (!user) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: { id: true, body: true, removedAt: true, createdAt: true, parentId: true },
    });
    res.status(200).json({
      account: accountDto(user),
      posts: posts.map((post) => ({
        id: post.id,
        body: post.body,
        parentId: post.parentId,
        removedAt: post.removedAt ? post.removedAt.toISOString() : null,
        createdAt: post.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    fail(res, error, "Get account error:");
  }
});

adminRouter.get("/log", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const events = await prisma.moderationEvent.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE,
      include: { actor: { select: AUTHOR_SELECT } },
    });
    res.status(200).json({
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        note: event.note,
        targetUserId: event.targetUserId,
        targetPostId: event.targetPostId,
        reportId: event.reportId,
        createdAt: event.createdAt.toISOString(),
        actor: toAuthorDto(event.actor),
      })),
    });
  } catch (error) {
    fail(res, error, "Moderation log error:");
  }
});

adminRouter.post("/reports/:id/dismiss", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note, reportId } = cleanNote({ ...(req.body ?? {}), reportId: req.params.id });
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      select: { userId: true, postId: true },
    });
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await writeEvent(tx, req.userId!, ModerationAction.dismiss_report, note, reportId, {
        targetUserId: report.userId,
        targetPostId: report.postId,
      });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Dismiss report error:");
  }
});

async function loadAccount(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, verified: true, staff: true, suspendedAt: true },
  });
  if (!user) throw new DeskError("Account not found", 404);
  return user;
}

adminRouter.post("/accounts/:id/verify", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note, reportId } = cleanNote(req.body);
    const user = await loadAccount(req.params.id);
    if (user.verified) throw new DeskError("This account is already verified", 409);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { verified: true } });
      await writeEvent(tx, req.userId!, ModerationAction.verify, note, reportId, { targetUserId: user.id });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Verify error:");
  }
});

adminRouter.post("/accounts/:id/unverify", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note, reportId } = cleanNote(req.body);
    const user = await loadAccount(req.params.id);
    if (!user.verified) throw new DeskError("This account is not verified", 409);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { verified: false } });
      await writeEvent(tx, req.userId!, ModerationAction.unverify, note, reportId, { targetUserId: user.id });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Unverify error:");
  }
});

adminRouter.post("/accounts/:id/suspend", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note, reportId } = cleanNote(req.body);
    if (req.params.id === req.userId) throw new DeskError("You can't take down your own account", 400);
    const user = await loadAccount(req.params.id);
    if (user.suspendedAt) throw new DeskError("This account is already taken down", 409);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { suspendedAt: new Date() } });
      await writeEvent(tx, req.userId!, ModerationAction.suspend, note, reportId, { targetUserId: user.id });
    });
    publishLiveRemoval({ authorIds: [user.id] });
    disconnectLive(user.id);
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Suspend error:");
  }
});

adminRouter.post("/accounts/:id/restore", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note, reportId } = cleanNote(req.body);
    const user = await loadAccount(req.params.id);
    if (!user.suspendedAt) throw new DeskError("This account is already on the floor", 409);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { suspendedAt: null } });
      await writeEvent(tx, req.userId!, ModerationAction.restore_account, note, reportId, { targetUserId: user.id });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Restore account error:");
  }
});

adminRouter.post("/accounts/:id/staff", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note, reportId } = cleanNote(req.body);
    const grant = req.body?.grant === true;
    if (!grant && req.params.id === req.userId) throw new DeskError("You can't remove your own staff access", 400);
    const user = await loadAccount(req.params.id);
    if (grant && user.suspendedAt) throw new DeskError("Restore the account before making them staff", 400);
    if (grant === user.staff) throw new DeskError(grant ? "This account is already staff" : "This account is not staff", 409);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { staff: grant } });
      await writeEvent(tx, req.userId!, grant ? ModerationAction.grant_staff : ModerationAction.revoke_staff, note, reportId, {
        targetUserId: user.id,
      });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Staff access error:");
  }
});

adminRouter.post("/posts/:id/remove", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note, reportId } = cleanNote(req.body);
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, removedAt: true },
    });
    if (!post) throw new DeskError("Post not found", 404);
    if (post.removedAt) throw new DeskError("That post is already off the floor", 409);
    await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id: post.id }, data: { removedAt: new Date() } });
      await writeEvent(tx, req.userId!, ModerationAction.remove_post, note, reportId, {
        targetUserId: post.authorId,
        targetPostId: post.id,
      });
    });
    publishLiveRemoval({ postIds: [post.id] });
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Remove post error:");
  }
});

adminRouter.post("/posts/:id/restore", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note, reportId } = cleanNote(req.body);
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, removedAt: true, author: { select: { suspendedAt: true } } },
    });
    if (!post) throw new DeskError("Post not found", 404);
    if (!post.removedAt) throw new DeskError("That post is already on the floor", 409);
    if (post.author.suspendedAt) throw new DeskError("Restore the account before putting this post back", 400);
    await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id: post.id }, data: { removedAt: null } });
      await writeEvent(tx, req.userId!, ModerationAction.restore_post, note, reportId, {
        targetUserId: post.authorId,
        targetPostId: post.id,
      });
    });
    const restored = await prisma.post.findUnique({ where: { id: post.id }, include: postInclude(req.userId!) });
    if (restored) {
      await publishLivePost(toPostDto(restored)).catch((error) => console.error("Live restore failed", error));
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Restore post error:");
  }
});
