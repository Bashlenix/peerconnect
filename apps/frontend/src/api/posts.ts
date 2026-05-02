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

export type SinceFilter = "24h" | "3d" | "7d";

export interface GetPostsParams {
  limit?: number;
  offset?: number;
  category?: PostCategory;
  since?: SinceFilter;
  subscribed?: boolean;
}

export async function getPosts(params?: GetPostsParams): Promise<GetPostsResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.category) query.set("category", params.category);
  if (params?.since) query.set("since", params.since);
  if (params?.subscribed != null) query.set("subscribed", String(params.subscribed));

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
  hasUpvoted: boolean;
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

export async function upvoteReply(replyId: string): Promise<{ upvoteCount: number }> {
  const res = await fetch(`${BASE}/replies/${replyId}/upvote`, {
    method: "POST",
    credentials: "include",
  });
  const data = (await res.json()) as { upvoteCount?: number; message?: string };
  if (!res.ok) throw new Error(data.message ?? "Failed to upvote");
  return { upvoteCount: data.upvoteCount! };
}

export async function removeUpvote(replyId: string): Promise<void> {
  const res = await fetch(`${BASE}/replies/${replyId}/upvote`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to remove upvote");
  }
}

export async function updateReply(replyId: string, content: string): Promise<Reply> {
  const res = await fetch(`${BASE}/replies/${replyId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content }),
  });
  const data = (await res.json()) as Reply & { message?: string };
  if (!res.ok) throw new Error(data.message ?? "Failed to update reply");
  return data;
}

export async function deleteReply(replyId: string): Promise<void> {
  const res = await fetch(`${BASE}/replies/${replyId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to delete reply");
  }
}

export async function setSolution(postId: string, replyId: string): Promise<void> {
  const res = await fetch(`${BASE}/posts/${postId}/solution`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ replyId }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to mark solution");
  }
}

export async function removeSolution(postId: string): Promise<void> {
  const res = await fetch(`${BASE}/posts/${postId}/solution`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to unmark solution");
  }
}

export async function updatePost(postId: string, content: string): Promise<Post> {
  const res = await fetch(`${BASE}/posts/${postId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content }),
  });
  const data = (await res.json()) as Post & { message?: string };
  if (!res.ok) throw new Error(data.message ?? "Failed to update post");
  return data;
}

export async function deletePost(postId: string): Promise<void> {
  const res = await fetch(`${BASE}/posts/${postId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to delete post");
  }
}
