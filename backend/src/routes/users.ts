import { Router, Response } from "express";
import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AUTHOR_SELECT, toAuthorDto } from "../lib/author";
import { pageSize, postInclude, toPostDto } from "../lib/post";
import { notify, unnotify } from "../lib/notify";
import { authenticateJwt, AuthenticatedRequest } from "../middleware/auth";
import { FINANCE_TITLE_GROUPS, FINANCE_TITLES, TITLE_LOCK_DAYS, titleLockedUntil } from "../lib/finance-titles";

export const usersRouter = Router();

usersRouter.use(authenticateJwt);

const SUGGESTED_LIMIT = 5;
const MAX_SUGGESTED_LIMIT = 20;
const NAME_LIMIT = 50;
const BIO_LIMIT = 160;
const LOCATION_LIMIT = 30;
const WEBSITE_LIMIT = 100;
const BANNERS = new Set(["ember", "lagoon", "ink", "forest", "dusk"]);
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "help",
  "liquidity",
  "me",
  "null",
  "official",
  "root",
  "square",
  "support",
  "system",
  "undefined",
  "you",
]);

const profileSelect = {
  ...AUTHOR_SELECT,
  bio: true,
  location: true,
  website: true,
  banner: true,
  titleChangedAt: true,
  createdAt: true,
  _count: { select: { posts: true, followers: true, following: true } },
} satisfies Prisma.UserSelect;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

class HttpError extends Error {}

async function activityCounts(userId: string) {
  const [posts, replies, reposts, likes] = await Promise.all([
    prisma.post.count({ where: { authorId: userId, parentId: null } }),
    prisma.post.count({ where: { authorId: userId, parentId: { not: null } } }),
    prisma.repost.count({ where: { userId } }),
    prisma.like.count({ where: { userId } }),
  ]);
  return { posts, replies, reposts, likes };
}

function toProfile(
  user: ProfileRow,
  followedByMe: boolean,
  activity: { posts: number; replies: number; reposts: number; likes: number },
) {
  const locked = titleLockedUntil(user.titleChangedAt);
  return {
    ...toAuthorDto(user),
    joinedAt: user.createdAt.toISOString(),
    posts: activity.posts,
    replies: activity.replies,
    reposts: activity.reposts,
    likes: activity.likes,
    followers: user._count.followers,
    following: user._count.following,
    followedByMe,
    bio: user.bio,
    location: user.location,
    website: user.website,
    banner: user.banner,
    titleLockedUntil: locked ? locked.toISOString() : null,
  };
}

function cleanUsername(value: unknown): string {
  if (typeof value !== "string") throw new HttpError("Username must be text");
  const handle = value.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw new HttpError("Username must be 3–20 letters, numbers, or underscores");
  }
  if (RESERVED_USERNAMES.has(handle)) throw new HttpError("That username is reserved");
  return handle;
}

function cleanTitle(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !FINANCE_TITLES.has(value.trim())) {
    throw new HttpError("Pick a title from the list");
  }
  return value.trim();
}

function formatLockDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new HttpError(`${label} must be text`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new HttpError(`${label} must be ${max} characters or fewer`);
  return trimmed;
}

function cleanWebsite(value: unknown): string | null {
  const text = optionalText(value, WEBSITE_LIMIT, "Website");
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (withScheme.length > WEBSITE_LIMIT) throw new HttpError(`Website must be ${WEBSITE_LIMIT} characters or fewer`);
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new HttpError("Website must be a valid link");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".")) {
    throw new HttpError("Website must be a valid link");
  }
  return withScheme;
}

function cleanImage(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new HttpError("Photo must be an image");
  if (/^https:\/\/\S+$/.test(value) && value.length <= 500) return value;
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value) && value.length <= 250_000) return value;
  throw new HttpError("Photo must be a JPEG, PNG, or WebP image");
}

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

// GET /api/users/titles — finance titles a profile can carry
usersRouter.get("/titles", (_req: AuthenticatedRequest, res: Response): void => {
  res.status(200).json({ lockDays: TITLE_LOCK_DAYS, groups: FINANCE_TITLE_GROUPS });
});

// PATCH /api/users/me — name, username, title, bio, location, website, photo, banner
usersRouter.patch("/me", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Prisma.UserUpdateInput = {};

    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        res.status(400).json({ error: "Name can't be empty" });
        return;
      }
      const name = body.name.trim();
      if (name.length > NAME_LIMIT) {
        res.status(400).json({ error: `Name must be ${NAME_LIMIT} characters or fewer` });
        return;
      }
      const parts = name.split(/\s+/);
      data.firstName = parts[0];
      data.lastName = parts.slice(1).join(" ");
    }
    if ("bio" in body) data.bio = optionalText(body.bio, BIO_LIMIT, "Bio");
    if ("location" in body) data.location = optionalText(body.location, LOCATION_LIMIT, "Location");
    if ("website" in body) data.website = cleanWebsite(body.website);
    if ("banner" in body) {
      if (body.banner != null && (typeof body.banner !== "string" || !BANNERS.has(body.banner))) {
        res.status(400).json({ error: "Pick a banner from the list" });
        return;
      }
      data.banner = typeof body.banner === "string" ? body.banner : null;
    }
    if ("image" in body) data.image = cleanImage(body.image);

    if ("username" in body || "title" in body) {
      const current = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { username: true, title: true, titleChangedAt: true },
      });
      if (!current) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if ("username" in body) {
        const next = cleanUsername(body.username);
        if (next !== current.username) data.username = next;
      }
      if ("title" in body) {
        const next = cleanTitle(body.title);
        if ((current.title ?? null) !== next) {
          const locked = titleLockedUntil(current.titleChangedAt);
          if (locked) {
            res.status(400).json({
              error: `You can change your title again on ${formatLockDate(locked)}`,
            });
            return;
          }
          data.title = next;
          data.titleChangedAt = new Date();
        }
      }
    }

    const [user, activity] = await Promise.all([
      prisma.user.update({
        where: { id: req.userId! },
        data,
        select: profileSelect,
      }),
      activityCounts(req.userId!),
    ]);
    res.status(200).json({ profile: toProfile(user, false, activity) });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "That username is taken" });
      return;
    }
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function findProfileUser(key: string) {
  const byId = await prisma.user.findUnique({ where: { id: key }, select: profileSelect });
  if (byId) return byId;
  const handle = key.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,40}$/.test(handle)) return null;
  const byUsername = await prisma.user.findUnique({ where: { username: handle }, select: profileSelect });
  if (byUsername) return byUsername;
  return prisma.user.findFirst({
    where: { username: null, email: { startsWith: `${handle}@`, mode: "insensitive" } },
    select: profileSelect,
  });
}

// GET /api/users/:id — public profile, by id or @handle
usersRouter.get("/:id", async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
  try {
    const user = await findProfileUser(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const id = user.id;
    const [followedByMe, activity] = await Promise.all([
      prisma.follow.count({ where: { followerId: req.userId!, followingId: id } }),
      activityCounts(id),
    ]);

    res.status(200).json({ profile: toProfile(user, followedByMe > 0, activity) });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function connectionUsers(id: string, kind: "followers" | "following") {
  const exists = await prisma.user.count({ where: { id } });
  if (exists === 0) return null;

  if (kind === "followers") {
    const rows = await prisma.follow.findMany({
      where: { followingId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { follower: { select: AUTHOR_SELECT } },
    });
    return rows.map((row) => toAuthorDto(row.follower));
  }

  const rows = await prisma.follow.findMany({
    where: { followerId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { following: { select: AUTHOR_SELECT } },
  });
  return rows.map((row) => toAuthorDto(row.following));
}

function connectionRoute(kind: "followers" | "following") {
  return async (req: AuthenticatedRequest<{ id: string }>, res: Response): Promise<void> => {
    try {
      const users = await connectionUsers(req.params.id, kind);
      if (!users) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.status(200).json({ users });
    } catch (error) {
      console.error(`List ${kind} error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

usersRouter.get("/:id/followers", connectionRoute("followers"));
usersRouter.get("/:id/following", connectionRoute("following"));

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
