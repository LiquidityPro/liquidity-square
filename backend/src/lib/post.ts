import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { AUTHOR_SELECT, toAuthorDto } from "./author";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export function pageSize(raw: unknown): number {
  return Math.min(Math.max(Number(raw) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
}

export function pollInclude(userId: string) {
  return {
    options: {
      orderBy: { position: "asc" as const },
      include: { _count: { select: { votes: true } } },
    },
    votes: { where: { userId }, select: { optionId: true }, take: 1 },
  } satisfies Prisma.PollInclude;
}

const quoteInclude = {
  author: { select: AUTHOR_SELECT },
  tickers: { select: { symbol: true } },
} satisfies Prisma.PostInclude;

export function postInclude(userId: string) {
  const mine = { where: { userId }, select: { userId: true } };
  return {
    author: { select: AUTHOR_SELECT },
    tickers: { select: { symbol: true } },
    likes: mine,
    reposts: mine,
    bookmarks: mine,
    parent: { select: { id: true, author: { select: AUTHOR_SELECT } } },
    quote: { include: quoteInclude },
    poll: { include: pollInclude(userId) },
    _count: { select: { likes: true, reposts: true, replies: true, bookmarks: true } },
  } satisfies Prisma.PostInclude;
}

export type PostWithRelations = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

function toQuoteDto(post: NonNullable<PostWithRelations["quote"]>) {
  return {
    id: post.id,
    author: toAuthorDto(post.author),
    body: post.body,
    stance: post.stance,
    tickers: post.tickers.map((t) => t.symbol),
    createdAt: post.createdAt.toISOString(),
  };
}

export function toPollDto(poll: NonNullable<PostWithRelations["poll"]>) {
  const options = poll.options.map((option) => ({
    id: option.id,
    label: option.label,
    stance: option.stance,
    votes: option._count.votes,
  }));
  return {
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    myOptionId: poll.votes[0]?.optionId ?? null,
    options,
  };
}

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
    bookmarks: post._count.bookmarks,
    likedByMe: post.likes.length > 0,
    repostedByMe: post.reposts.length > 0,
    bookmarkedByMe: post.bookmarks.length > 0,
    parentId: post.parentId,
    replyTo: post.parent ? toAuthorDto(post.parent.author) : null,
    quote: post.quote ? toQuoteDto(post.quote) : null,
    poll: post.poll ? toPollDto(post.poll) : null,
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

/** Posts this person has reposted, newest repost first. */
export async function listReposts(
  viewerId: string,
  reposterId: string,
  { cursor, limit }: { cursor?: unknown; limit: number },
) {
  const cursorId = typeof cursor === "string" && cursor ? cursor : null;
  const cursorRow = cursorId
    ? await prisma.repost.findUnique({
        where: { userId_postId: { userId: reposterId, postId: cursorId } },
        select: { createdAt: true },
      })
    : null;
  if (cursorId && !cursorRow) return { posts: [], nextCursor: null };

  const rows = await prisma.repost.findMany({
    where: {
      userId: reposterId,
      ...(cursorRow && cursorId
        ? {
            OR: [
              { createdAt: { lt: cursorRow.createdAt } },
              { createdAt: cursorRow.createdAt, postId: { lt: cursorId } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { postId: "desc" }],
    take: limit + 1,
    include: { post: { include: postInclude(viewerId) } },
  });

  const page = rows.slice(0, limit);
  return {
    posts: page.map((row) => toPostDto(row.post)),
    nextCursor: rows.length > limit ? page[page.length - 1].postId : null,
  };
}
