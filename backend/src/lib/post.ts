import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { AUTHOR_SELECT, toAuthorDto } from "./author";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export function pageSize(raw: unknown): number {
  return Math.min(Math.max(Number(raw) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
}

export function postInclude(userId: string) {
  const mine = { where: { userId }, select: { userId: true } };
  return {
    author: { select: AUTHOR_SELECT },
    tickers: { select: { symbol: true } },
    likes: mine,
    reposts: mine,
    bookmarks: mine,
    parent: { select: { id: true, author: { select: AUTHOR_SELECT } } },
    _count: { select: { likes: true, reposts: true, replies: true } },
  } satisfies Prisma.PostInclude;
}

export type PostWithRelations = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

export function toPostDto(post: PostWithRelations) {
  return {
    id: post.id,
    author: toAuthorDto(post.author),
    body: post.body,
    stance: post.stance,
    tickers: post.tickers.map((t) => t.symbol),
    likes: post._count.likes,
    reposts: post._count.reposts,
    replies: post._count.replies,
    likedByMe: post.likes.length > 0,
    repostedByMe: post.reposts.length > 0,
    bookmarkedByMe: post.bookmarks.length > 0,
    parentId: post.parentId,
    replyTo: post.parent ? toAuthorDto(post.parent.author) : null,
    createdAt: post.createdAt.toISOString(),
  };
}

export async function listPosts(
  userId: string,
  where: Prisma.PostWhereInput,
  { cursor, limit, order = "desc" }: { cursor?: unknown; limit: number; order?: Prisma.SortOrder },
) {
  const posts = await prisma.post.findMany({
    where,
    include: postInclude(userId),
    orderBy: [{ createdAt: order }, { id: order }],
    take: limit + 1,
    ...(typeof cursor === "string" && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = posts.slice(0, limit);
  return {
    posts: page.map(toPostDto),
    nextCursor: posts.length > limit ? page[page.length - 1].id : null,
  };
}
