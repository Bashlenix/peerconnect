import type { PrismaClient } from "../generated/prisma/client.js";

export interface FeedQueryParams {
  limit: number;
  offset: number;
}

export interface FeedPost {
  id: string;
  content: string;
  category: string;
  isUrgent: boolean;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; firstName: string | null; lastName: string | null };
  replyCount: number;
}

export async function getFeedPosts(prisma: PrismaClient, params: FeedQueryParams): Promise<FeedPost[]> {
  const posts = await prisma.post.findMany({
    skip: params.offset,
    take: params.limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      category: true,
      isUrgent: true,
      createdAt: true,
      editedAt: true,
      author: {
        select: { id: true, firstName: true, lastName: true },
      },
      _count: { select: { replies: true } },
    },
  });

  return posts.map((p) => ({
    id: p.id,
    content: p.content,
    category: p.category as string,
    isUrgent: p.isUrgent,
    createdAt: p.createdAt,
    editedAt: p.editedAt,
    author: p.author,
    replyCount: p._count.replies,
  }));
}
