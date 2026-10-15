import { signOutSession } from "@/lib/session";
import type {
  Author,
  NotificationType,
  Poll,
  Post,
  PriceAlert,
  Profile,
  QuotedPost,
  ReportReason,
  SentimentCounts,
  SentimentWindows,
  SquareNotification,
  Stance,
  TickerSummary,
} from "./data";

type AuthorDto = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  image: string | null;
  title?: string | null;
};

type QuoteDto = {
  id: string;
  author: AuthorDto;
  body: string;
  stance: Stance;
  tickers: string[];
  createdAt: string;
};

type PollDto = {
  totalVotes: number;
  myOptionId: string | null;
  options: { id: string; label: string; stance: Stance; votes: number }[];
};

type PostDto = {
  id: string;
  author: AuthorDto;
  body: string;
  stance: Stance;
  tickers: string[];
  likes: number;
  reposts: number;
  replies: number;
  likedByMe: boolean;
  repostedByMe: boolean;
  bookmarkedByMe: boolean;
  parentId: string | null;
  replyTo: AuthorDto | null;
  quote: QuoteDto | null;
  poll: PollDto | null;
  createdAt: string;
};

type PageDto = { posts: PostDto[]; nextCursor: string | null };

export type PostPage = { posts: Post[]; nextCursor: string | null };

export type Reaction = "like" | "repost" | "bookmark";

async function request<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/server${path}`, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (res.status === 401) {
    void signOutSession();
    throw new Error(data.error || "Invalid or expired token");
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

function query(params: Record<string, string | undefined | null>): string {
  const entries = Object.entries(params).filter((e): e is [string, string] => !!e[1]);
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
}

export function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toAuthor(dto: AuthorDto): Author {
  return {
    id: dto.id,
    name: dto.name,
    handle: dto.handle,
    initials: dto.initials,
    image: dto.image,
    role: dto.title ?? undefined,
  };
}

function toQuote(dto: QuoteDto): QuotedPost {
  return {
    id: dto.id,
    author: toAuthor(dto.author),
    body: dto.body,
    stance: dto.stance,
    tickers: dto.tickers,
    createdAt: dto.createdAt,
    time: relativeTime(dto.createdAt),
  };
}

function toPoll(dto: PollDto): Poll {
  return {
    totalVotes: dto.totalVotes,
    myOptionId: dto.myOptionId,
    options: dto.options,
  };
}

function toPost(dto: PostDto): Post {
  return {
    id: dto.id,
    author: toAuthor(dto.author),
    time: relativeTime(dto.createdAt),
    createdAt: dto.createdAt,
    body: dto.body,
    stance: dto.stance,
    tickers: dto.tickers,
    replies: dto.replies,
    reposts: dto.reposts,
    likes: dto.likes,
    likedByMe: dto.likedByMe,
    repostedByMe: dto.repostedByMe,
    bookmarkedByMe: dto.bookmarkedByMe,
    parentId: dto.parentId,
    replyTo: dto.replyTo ? toAuthor(dto.replyTo) : null,
    quote: dto.quote ? toQuote(dto.quote) : null,
    poll: dto.poll ? toPoll(dto.poll) : null,
  };
}

function toPage({ posts, nextCursor }: PageDto): PostPage {
  return { posts: posts.map(toPost), nextCursor };
}

/* Posts                                                               */
/* ------------------------------------------------------------------ */

export type PostFilters = {
  ticker?: string;
  sector?: string;
  feed?: "following" | "watchlist";
  author?: string;
  likedBy?: string;
  repostedBy?: string;
  replies?: boolean;
  cursor?: string | null;
};

export type PollDraft = { options: { label: string; stance: Stance }[] };

export type PostDraft = {
  body: string;
  stance: Stance;
  parentId?: string | null;
  quoteId?: string | null;
  poll?: PollDraft | null;
};

export async function fetchPosts(token: string, filters: PostFilters = {}): Promise<PostPage> {
  return toPage(
    await request<PageDto>(
      `/posts${query({
        ticker: filters.ticker,
        sector: filters.sector,
        feed: filters.feed,
        author: filters.author,
        likedBy: filters.likedBy,
        repostedBy: filters.repostedBy,
        replies: filters.replies ? "1" : undefined,
        cursor: filters.cursor,
      })}`,
      token,
    ),
  );
}

export async function fetchPost(token: string, id: string): Promise<{ post: Post; parent: Post | null }> {
  const { post, parent } = await request<{ post: PostDto; parent: PostDto | null }>(
    `/posts/${encodeURIComponent(id)}`,
    token,
  );
  return { post: toPost(post), parent: parent ? toPost(parent) : null };
}

export async function fetchReplies(token: string, id: string, cursor?: string | null): Promise<PostPage> {
  return toPage(await request<PageDto>(`/posts/${encodeURIComponent(id)}/replies${query({ cursor })}`, token));
}

export async function createPost(token: string, draft: PostDraft): Promise<Post> {
  const { post } = await request<{ post: PostDto }>("/posts", token, "POST", draft);
  return toPost(post);
}

export async function voteOnPoll(token: string, postId: string, optionId: string): Promise<Poll> {
  const { poll } = await request<{ poll: PollDto }>(`/posts/${encodeURIComponent(postId)}/vote`, token, "POST", {
    optionId,
  });
  return toPoll(poll);
}

export async function deletePost(token: string, id: string): Promise<void> {
  await request(`/posts/${encodeURIComponent(id)}`, token, "DELETE");
}

export function setReaction(token: string, postId: string, kind: Reaction, on: boolean) {
  return request<{ active: boolean; count: number }>(
    `/posts/${encodeURIComponent(postId)}/${kind}`,
    token,
    on ? "POST" : "DELETE",
  );
}

/* Users                                                               */
/* ------------------------------------------------------------------ */

type ProfileDto = AuthorDto & Omit<Profile, keyof Author>;

function toProfile(profile: ProfileDto): Profile {
  return { ...profile, ...toAuthor(profile), id: profile.id };
}

export async function fetchProfile(token: string, id: string): Promise<Profile> {
  const { profile } = await request<{ profile: ProfileDto }>(`/users/${encodeURIComponent(id)}`, token);
  return toProfile(profile);
}

export type ProfileUpdate = {
  name: string;
  username: string;
  title: string | null;
  bio: string;
  location: string;
  website: string;
  image: string | null;
  banner: string;
};

export async function updateProfile(token: string, input: ProfileUpdate): Promise<Profile> {
  const { profile } = await request<{ profile: ProfileDto }>("/users/me", token, "PATCH", input);
  return toProfile(profile);
}

export async function fetchConnections(
  token: string,
  id: string,
  kind: "followers" | "following",
): Promise<Author[]> {
  const { users } = await request<{ users: AuthorDto[] }>(
    `/users/${encodeURIComponent(id)}/${kind}`,
    token,
  );
  return users.map(toAuthor);
}

export async function fetchFollowing(token: string): Promise<Author[]> {
  const { users } = await request<{ users: AuthorDto[] }>("/users/me/following", token);
  return users.map(toAuthor);
}

export async function fetchSuggested(token: string, limit = 5): Promise<Author[]> {
  const { users } = await request<{ users: AuthorDto[] }>(`/users/suggested${query({ limit: String(limit) })}`, token);
  return users.map(toAuthor);
}

export function setFollowing(token: string, userId: string, on: boolean) {
  return request<{ following: boolean; followers: number }>(
    `/users/${encodeURIComponent(userId)}/follow`,
    token,
    on ? "POST" : "DELETE",
  );
}

export async function fetchBookmarks(token: string, cursor?: string | null): Promise<PostPage> {
  return toPage(await request<PageDto>(`/users/me/bookmarks${query({ cursor })}`, token));
}

/* Tickers & search                                                    */
/* ------------------------------------------------------------------ */

export async function fetchTickers(token: string, limit = 10, sector?: string): Promise<TickerSummary[]> {
  const { tickers } = await request<{ tickers: TickerSummary[] }>(
    `/tickers${query({ limit: String(limit), sector })}`,
    token,
  );
  return tickers;
}

export type TickerDetail = TickerSummary & {
  bulls: number;
  bears: number;
  watchedByMe: boolean;
  sentiment: SentimentWindows;
};

export async function fetchTicker(token: string, symbol: string, session?: string | null): Promise<TickerDetail> {
  const { ticker } = await request<{ ticker: TickerDetail }>(
    `/tickers/${encodeURIComponent(symbol.replace(/^\$/, "").toUpperCase())}${query({ session })}`,
    token,
  );
  return ticker;
}

export async function fetchWatchlist(token: string): Promise<TickerSummary[]> {
  const { tickers } = await request<{ tickers: TickerSummary[] }>("/tickers/watching", token);
  return tickers;
}

export function setWatching(token: string, symbol: string, on: boolean) {
  const path = `/tickers/${encodeURIComponent(symbol.replace(/^\$/, "").toUpperCase())}/watch`;
  return request<{ watching: boolean }>(path, token, on ? "POST" : "DELETE");
}

export async function fetchSentiment(
  token: string,
  symbols: string[],
  window: "session" | "week" | "month",
  session?: string | null,
): Promise<Array<SentimentCounts & { symbol: string }>> {
  const { sentiment } = await request<{ sentiment: Array<SentimentCounts & { symbol: string }> }>(
    `/tickers/sentiment${query({
      symbols: symbols.join(","),
      window,
      session,
    })}`,
    token,
  );
  return sentiment;
}

export async function fetchAlert(token: string, symbol: string): Promise<PriceAlert | null> {
  const { alerts } = await request<{ alerts: PriceAlert[] }>(
    `/alerts${query({ symbol: symbol.replace(/^\$/, "").toUpperCase() })}`,
    token,
  );
  return alerts[0] ?? null;
}

export async function saveAlert(
  token: string,
  symbol: string,
  input: { thresholdPct: number; direction: PriceAlert["direction"] },
): Promise<PriceAlert> {
  const { alert } = await request<{ alert: PriceAlert }>(
    `/alerts/${encodeURIComponent(symbol.replace(/^\$/, "").toUpperCase())}`,
    token,
    "PUT",
    input,
  );
  return alert;
}

export async function deleteAlert(token: string, symbol: string): Promise<void> {
  await request(`/alerts/${encodeURIComponent(symbol.replace(/^\$/, "").toUpperCase())}`, token, "DELETE");
}

export function setMuted(token: string, userId: string, on: boolean) {
  return request<{ muted: boolean }>(`/safety/mute/${encodeURIComponent(userId)}`, token, on ? "POST" : "DELETE");
}

export function setBlocked(token: string, userId: string, on: boolean) {
  return request<{ blocked: boolean }>(`/safety/block/${encodeURIComponent(userId)}`, token, on ? "POST" : "DELETE");
}

export async function fetchMuted(token: string): Promise<Author[]> {
  const { users } = await request<{ users: AuthorDto[] }>("/safety/muted", token);
  return users.map(toAuthor);
}

export async function fetchBlocked(token: string): Promise<Author[]> {
  const { users } = await request<{ users: AuthorDto[] }>("/safety/blocked", token);
  return users.map(toAuthor);
}

export async function reportContent(
  token: string,
  input: { reason: ReportReason; note?: string; postId?: string; userId?: string },
): Promise<void> {
  await request("/safety/reports", token, "POST", input);
}

export type SearchResults = { tickers: TickerSummary[]; users: Author[]; posts: Post[] };

export async function search(token: string, q: string): Promise<SearchResults> {
  const res = await request<{ tickers: TickerSummary[]; users: AuthorDto[]; posts: PostDto[] }>(
    `/search${query({ q })}`,
    token,
  );
  return { tickers: res.tickers, users: res.users.map(toAuthor), posts: res.posts.map(toPost) };
}

/* Notifications                                                       */
/* ------------------------------------------------------------------ */

type NotificationDto = {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: AuthorDto;
  post: { id: string; body: string } | null;
  symbol?: string | null;
  summary?: string | null;
  href?: string | null;
};

function toNotification(n: NotificationDto): SquareNotification {
  return {
    id: n.id,
    type: n.type,
    read: n.read,
    time: relativeTime(n.createdAt),
    actor: toAuthor(n.actor),
    post: n.post,
    symbol: n.symbol,
    summary: n.summary,
    href: n.href,
  };
}

export async function syncDisclosures(token: string): Promise<{ delivered: number; notifications: SquareNotification[] }> {
  const result = await request<{ delivered: number; notifications: NotificationDto[] }>("/disclosures/sync", token, "POST");
  return { delivered: result.delivered, notifications: result.notifications.map(toNotification) };
}

export async function fetchNotifications(
  token: string,
  cursor?: string | null,
): Promise<{ notifications: SquareNotification[]; nextCursor: string | null }> {
  const { notifications, nextCursor } = await request<{ notifications: NotificationDto[]; nextCursor: string | null }>(
    `/notifications${query({ cursor })}`,
    token,
  );
  return { notifications: notifications.map(toNotification), nextCursor };
}

export type MessageRead = { conversationId: string; readAt: string };

export type LiveUpdate = {
  now: string;
  unreadCount: number;
  unreadMessages: number;
  posts: Post[];
  notifications: SquareNotification[];
  messages: ChatMessage[];
  reads: MessageRead[];
};

export async function fetchLive(token: string, since: string | null): Promise<LiveUpdate> {
  const data = await request<{
    now: string;
    unreadCount: number;
    unreadMessages?: number;
    posts: PostDto[];
    notifications: NotificationDto[];
    messages?: ChatMessageDto[];
    reads?: MessageRead[];
  }>(`/live${query({ since })}`, token);
  return {
    now: data.now,
    unreadCount: data.unreadCount,
    unreadMessages: data.unreadMessages ?? 0,
    posts: data.posts.map(toPost),
    notifications: data.notifications.map(toNotification),
    messages: (data.messages ?? []).map(toChatMessage),
    reads: data.reads ?? [],
  };
}

export async function fetchUnreadCount(token: string): Promise<number> {
  const { count } = await request<{ count: number }>("/notifications/unread-count", token);
  return count;
}

export type ChatMessage = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  mine: boolean;
  sender: Author;
  pending?: boolean;
  failed?: boolean;
};

export type InboxThread = {
  id: string;
  with: Author;
  unread: boolean;
  lastMessage: { id: string; body: string; createdAt: string; mine: boolean } | null;
};

type ChatMessageDto = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  mine: boolean;
  sender: AuthorDto;
};

function toChatMessage(dto: ChatMessageDto): ChatMessage {
  return { ...dto, sender: toAuthor(dto.sender) };
}

export async function fetchInbox(token: string): Promise<InboxThread[]> {
  const { conversations } = await request<{
    conversations: Array<Omit<InboxThread, "with"> & { with: AuthorDto }>;
  }>("/messages", token);
  return conversations.map((thread) => ({ ...thread, with: toAuthor(thread.with) }));
}

export async function fetchThreadWith(token: string, userId: string): Promise<string | null> {
  const { conversationId } = await request<{ conversationId: string | null }>(
    `/messages/with/${encodeURIComponent(userId)}`,
    token,
  );
  return conversationId;
}

export async function fetchThread(
  token: string,
  id: string,
  cursor?: string | null,
): Promise<{ with: Author; messages: ChatMessage[]; nextCursor: string | null; peerReadAt: string | null }> {
  const data = await request<{
    conversation: { id: string; with: AuthorDto };
    messages: ChatMessageDto[];
    nextCursor: string | null;
    peerReadAt?: string | null;
  }>(`/messages/${encodeURIComponent(id)}${query({ cursor })}`, token);
  return {
    with: toAuthor(data.conversation.with),
    messages: data.messages.map(toChatMessage),
    nextCursor: data.nextCursor,
    peerReadAt: data.peerReadAt ?? null,
  };
}

export async function startConversation(
  token: string,
  userId: string,
  body: string,
): Promise<{ conversationId: string; message: ChatMessage; unreadMessages: number }> {
  const data = await request<{
    conversation: { id: string; with: AuthorDto };
    message: ChatMessageDto;
    unreadMessages: number;
  }>("/messages", token, "POST", { userId, body });
  return {
    conversationId: data.conversation.id,
    message: toChatMessage(data.message),
    unreadMessages: data.unreadMessages,
  };
}

export async function sendChatMessage(
  token: string,
  conversationId: string,
  body: string,
): Promise<{ message: ChatMessage; unreadMessages: number }> {
  const data = await request<{ message: ChatMessageDto; unreadMessages: number }>(
    `/messages/${encodeURIComponent(conversationId)}`,
    token,
    "POST",
    { body },
  );
  return { message: toChatMessage(data.message), unreadMessages: data.unreadMessages };
}

export async function markConversationRead(token: string, conversationId: string): Promise<number> {
  const { unreadMessages } = await request<{ unreadMessages: number }>(
    `/messages/${encodeURIComponent(conversationId)}/read`,
    token,
    "POST",
  );
  return unreadMessages;
}

export async function markNotificationsRead(token: string): Promise<void> {
  await request("/notifications/read", token, "POST");
}

export async function fetchVapidPublicKey(token: string): Promise<string> {
  const { publicKey } = await request<{ publicKey: string }>("/push/vapid-public-key", token);
  return publicKey;
}

export async function savePushSubscription(
  token: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  await request("/push/subscription", token, "PUT", subscription);
}
