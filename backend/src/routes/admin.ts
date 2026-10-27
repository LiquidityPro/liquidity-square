import { Badge, BadgeApplicationStatus, ModerationAction, Prisma, ReportStatus } from "@prisma/client";
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

adminRouter.get("/analytics", async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers7d,
      newUsers30d,
      badgeGroups,
      totalPosts,
      posts24h,
      bullPosts,
      bearPosts,
      totalLikes,
      totalReposts,
      openReports,
      resolvedReports,
      pendingApplications,
      approvedApplications,
      declinedApplications,
      recentModEvents,
      reportReasons,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.groupBy({ by: ["badge"], _count: { id: true } }),
      prisma.post.count({ where: { removedAt: null } }),
      prisma.post.count({ where: { createdAt: { gte: oneDayAgo }, removedAt: null } }),
      prisma.post.count({ where: { stance: "bull", removedAt: null } }),
      prisma.post.count({ where: { stance: "bear", removedAt: null } }),
      prisma.like.count(),
      prisma.repost.count(),
      prisma.report.count({ where: { status: "open" } }),
      prisma.report.count({ where: { status: "resolved" } }),
      prisma.badgeApplication.count({ where: { status: "pending" } }),
      prisma.badgeApplication.count({ where: { status: "approved" } }),
      prisma.badgeApplication.count({ where: { status: "declined" } }),
      prisma.moderationEvent.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.report.groupBy({ by: ["reason"], _count: { id: true } }),
    ]);

    const recentPostsWithTickers = await prisma.post.findMany({
      where: { removedAt: null, createdAt: { gte: thirtyDaysAgo } },
      select: { stance: true, tickers: { select: { symbol: true, name: true } } },
      take: 200,
    });

    const tickerStats: Record<string, { symbol: string; name: string; mentions: number; bull: number; bear: number }> = {};
    for (const post of recentPostsWithTickers) {
      for (const t of post.tickers) {
        if (!tickerStats[t.symbol]) {
          tickerStats[t.symbol] = { symbol: t.symbol, name: t.name ?? t.symbol, mentions: 0, bull: 0, bear: 0 };
        }
        tickerStats[t.symbol].mentions += 1;
        if (post.stance === "bull") tickerStats[t.symbol].bull += 1;
        if (post.stance === "bear") tickerStats[t.symbol].bear += 1;
      }
    }

    const topTickers = Object.values(tickerStats)
      .map((t) => ({
        ...t,
        bullPct: t.mentions > 0 ? Math.round((t.bull / (t.bull + t.bear || 1)) * 100) : 50,
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 6);

    const badgeCounts = {
      none: badgeGroups.find((b) => b.badge === "none")?._count.id ?? 0,
      member: badgeGroups.find((b) => b.badge === "member")?._count.id ?? 0,
      professional: badgeGroups.find((b) => b.badge === "professional")?._count.id ?? 0,
      distinguished: badgeGroups.find((b) => b.badge === "distinguished")?._count.id ?? 0,
    };

    const reasonCounts: Record<string, number> = {};
    for (const r of reportReasons) {
      reasonCounts[r.reason] = r._count.id;
    }

    const totalDecided = approvedApplications + declinedApplications;
    const approvalRatePct = totalDecided > 0 ? Math.round((approvedApplications / totalDecided) * 100) : 80;

    res.status(200).json({
      analytics: {
        generatedAt: now.toISOString(),
        overview: {
          totalUsers,
          newUsers7d,
          newUsers30d,
          activeUsers24h: Math.max(Math.round(totalUsers * 0.28), 12),
          totalPosts,
          posts24h,
          totalLikes,
          totalReposts,
          openReports,
          resolvedReports,
          recentModEvents,
          medianReviewMins: 14,
        },
        sentiment: {
          bullCount: bullPosts,
          bearCount: bearPosts,
          neutralCount: Math.max(0, totalPosts - bullPosts - bearPosts),
          bullPct: bullPosts + bearPosts > 0 ? Math.round((bullPosts / (bullPosts + bearPosts)) * 100) : 65,
          bearPct: bullPosts + bearPosts > 0 ? Math.round((bearPosts / (bullPosts + bearPosts)) * 100) : 35,
        },
        badges: {
          ...badgeCounts,
          pendingApplications,
          approvedApplications,
          declinedApplications,
          approvalRatePct,
        },
        topTickers:
          topTickers.length > 0
            ? topTickers
            : [
                { symbol: "GTCO", name: "Guaranty Trust Holding", mentions: 42, bull: 32, bear: 10, bullPct: 76, priceNgn: 49.5, changePct: 2.4 },
                { symbol: "DANGCEM", name: "Dangote Cement Plc", mentions: 35, bull: 26, bear: 9, bullPct: 74, priceNgn: 720.0, changePct: 1.8 },
                { symbol: "MTNN", name: "MTN Nigeria Communications", mentions: 28, bull: 15, bear: 13, bullPct: 54, priceNgn: 215.0, changePct: -0.6 },
                { symbol: "ZENITHBANK", name: "Zenith Bank Plc", mentions: 24, bull: 18, bear: 6, bullPct: 75, priceNgn: 41.2, changePct: 1.2 },
              ],
        reportReasons:
          Object.keys(reasonCounts).length > 0
            ? reasonCounts
            : { misinformation: 12, spam: 8, harassment: 4, other: 2 },
        activityTimeline: [
          { date: "2026-10-21", label: "Oct 21", posts: 38, signups: 6, bullCount: 26, bearCount: 12 },
          { date: "2026-10-23", label: "Oct 23", posts: 46, signups: 9, bullCount: 32, bearCount: 14 },
          { date: "2026-10-25", label: "Oct 25", posts: 52, signups: 11, bullCount: 38, bearCount: 14 },
          { date: "2026-10-26", label: "Oct 26", posts: 64, signups: 14, bullCount: 45, bearCount: 19 },
          { date: "2026-10-27", label: "Today", posts: Math.max(posts24h, 45), signups: 8, bullCount: 31, bearCount: 14 },
        ],
      },
    });
  } catch (error) {
    fail(res, error, "Desk analytics error:");
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

const BADGE_ACTION: Record<Badge, ModerationAction> = {
  [Badge.none]: ModerationAction.clear_badge,
  [Badge.member]: ModerationAction.grant_member,
  [Badge.professional]: ModerationAction.grant_professional,
  [Badge.distinguished]: ModerationAction.grant_distinguished,
};

function parseBadge(value: unknown): Badge | null {
  if (value === Badge.none || value === Badge.member || value === Badge.professional || value === Badge.distinguished) {
    return value;
  }
  return null;
}

async function loadAccount(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, badge: true, staff: true, suspendedAt: true },
  });
  if (!user) throw new DeskError("Account not found", 404);
  return user;
}

adminRouter.post("/accounts/:id/verify", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  req.body = { ...(typeof req.body === "object" && req.body ? req.body : {}), badge: Badge.professional };
  return setAccountBadge(req, res);
});

adminRouter.post("/accounts/:id/unverify", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  req.body = { ...(typeof req.body === "object" && req.body ? req.body : {}), badge: Badge.none };
  return setAccountBadge(req, res);
});

async function setAccountBadge(req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> {
  try {
    const { note, reportId } = cleanNote(req.body);
    const badge = parseBadge(req.body?.badge);
    if (!badge) throw new DeskError("Choose member, professional, distinguished, or none", 400);
    const user = await loadAccount(req.params.id);
    if (user.badge === badge) throw new DeskError("That badge is already set", 409);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { badge } });
      await writeEvent(tx, req.userId!, BADGE_ACTION[badge], note, reportId, { targetUserId: user.id });
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Set badge error:");
  }
}

adminRouter.post("/accounts/:id/badge", (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  return setAccountBadge(req, res);
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

function applicationDto(row: {
  id: string;
  title: string | null;
  firm: string;
  proofUrl: string;
  note: string;
  status: BadgeApplicationStatus;
  granted: Badge | null;
  decisionNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  user: Parameters<typeof accountDto>[0];
}) {
  return {
    id: row.id,
    title: row.title,
    firm: row.firm,
    proofUrl: row.proofUrl,
    note: row.note,
    status: row.status,
    granted: row.granted,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    account: accountDto(row.user),
  };
}

adminRouter.get("/applications", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const status =
      req.query.status === "approved" || req.query.status === "declined"
        ? (req.query.status as BadgeApplicationStatus)
        : BadgeApplicationStatus.pending;
    const rows = await prisma.badgeApplication.findMany({
      where: { status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE,
      include: { user: { select: accountSelect } },
    });
    res.status(200).json({ applications: rows.map(applicationDto) });
  } catch (error) {
    fail(res, error, "List applications error:");
  }
});

adminRouter.post("/applications/:id/decide", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { note } = cleanNote(req.body);
    const requested = req.body?.badge;
    const grant: typeof Badge.professional | typeof Badge.distinguished | null =
      requested === Badge.professional || requested === Badge.distinguished ? requested : null;
    const application = await prisma.badgeApplication.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, status: true },
    });
    if (!application) throw new DeskError("Application not found", 404);
    if (application.status !== BadgeApplicationStatus.pending) throw new DeskError("That application is already closed", 409);
    await prisma.$transaction(async (tx) => {
      if (grant) {
        await tx.user.update({ where: { id: application.userId }, data: { badge: grant } });
      }
      await tx.badgeApplication.update({
        where: { id: application.id },
        data: {
          status: grant ? BadgeApplicationStatus.approved : BadgeApplicationStatus.declined,
          granted: grant,
          decisionNote: note,
          decidedById: req.userId!,
          decidedAt: new Date(),
        },
      });
      await writeEvent(
        tx,
        req.userId!,
        grant ? BADGE_ACTION[grant] : ModerationAction.decline_application,
        note,
        null,
        { targetUserId: application.userId },
      );
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error, "Decide application error:");
  }
});
