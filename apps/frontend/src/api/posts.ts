const BASE = "/api";

export type PostCategory = "Academic" | "Social" | "Sport" | "DailyLifeSupport";

export interface PostAuthor {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export interface Post {
  id: string;
  content: string;
  category: PostCategory;
  isUrgent: boolean;
  createdAt: string;
  editedAt: string | null;
  author: PostAuthor;
  replyCount: number;
}

export interface GetPostsResponse {
  posts: Post[];
}

export interface CreatePostInput {
  content: string;
  category: PostCategory;
  isUrgent?: boolean;
}

export async function getPosts(params?: { limit?: number; offset?: number }): Promise<GetPostsResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));

  const url = `${BASE}/posts${query.size > 0 ? `?${query}` : ""}`;
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to fetch posts");
  }

  return res.json() as Promise<GetPostsResponse>;
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const res = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const data = (await res.json()) as Post & { message?: string };

  if (!res.ok) {
    throw new Error(data.message ?? "Failed to create post");
  }

  return data;
}

export interface Reply {
  id: string;
  content: string;
  isSolution: boolean;
  createdAt: string;
  editedAt: string | null;
  upvoteCount: number;
  author: PostAuthor;
}

export interface GetRepliesResponse {
  replies: Reply[];
}

export interface CreateReplyInput {
  content: string;
}

export async function getReplies(postId: string): Promise<GetRepliesResponse> {
  const res = await fetch(`${BASE}/posts/${postId}/replies`, { credentials: "include" });

  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to fetch replies");
  }

  return res.json() as Promise<GetRepliesResponse>;
}

export async function createReply(postId: string, input: CreateReplyInput): Promise<Reply> {
  const res = await fetch(`${BASE}/posts/${postId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const data = (await res.json()) as Reply & { message?: string };

  if (!res.ok) {
    throw new Error(data.message ?? "Failed to create reply");
  }

  return data;
}
