import type { Post, Stance } from "./data";

type AuthorDto = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  image: string | null;
};

type PostDto = {
  id: string;
  author: AuthorDto;
  body: string;
  stance: Stance;
  tickers: string[];
  likes: number;
  likedByMe: boolean;
  createdAt: string;
};

async function request<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/server${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

function relativeTime(iso: string): string {
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

function toPost(dto: PostDto): Post {
  return {
    id: dto.id,
    author: {
      id: dto.author.id,
      name: dto.author.name,
      handle: dto.author.handle,
      initials: dto.author.initials,
    },
    time: relativeTime(dto.createdAt),
    body: dto.body,
    stance: dto.stance,
    tickers: dto.tickers,
    replies: 0,
    reposts: 0,
    likes: dto.likes,
    likedByMe: dto.likedByMe,
  };
}

export async function fetchPosts(token: string): Promise<Post[]> {
  const { posts } = await request<{ posts: PostDto[] }>("/posts", token);
  return posts.map(toPost);
}

export async function createPost(token: string, body: string, stance: Stance): Promise<Post> {
  const { post } = await request<{ post: PostDto }>("/posts", token, "POST", { body, stance });
  return toPost(post);
}

export function setPostLiked(token: string, postId: string, liked: boolean) {
  return request<{ liked: boolean; likes: number }>(
    `/posts/${encodeURIComponent(postId)}/like`,
    token,
    liked ? "POST" : "DELETE",
  );
}
