import type { PostCategory, PrismaClient } from "../generated/prisma/client.js";

export type SinceFilter = "24h" | "3d" | "7d";

export interface FeedQueryParams {
  limit: number;
  offset: number;
  category?: PostCategory;
  since?: SinceFilter;
  subscribed?: boolean;
  userId?: string;
  authorId?: string;
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

export function sinceDate(since: SinceFilter): Date {
  const msMap: Record<SinceFilter, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() - msMap[since]);
}

export async function getFeedPosts(prisma: PrismaClient, params: FeedQueryParams): Promise<FeedPost[]> {
  let resolvedCategories: PostCategory[] | undefined;

  if (params.subscribed && params.userId) {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: params.userId },
      select: { category: true },
    });
    const subscribedCategories = prefs.map((p) => p.category);

    if (params.category) {
      resolvedCategories = subscribedCategories.includes(params.category) ? [params.category] : [];
    } else {
      resolvedCategories = subscribedCategories;
    }
  } else if (params.category) {
    resolvedCategories = [params.category];
  }

  if (resolvedCategories !== undefined && resolvedCategories.length === 0) {
    return [];
  }

  const where: {
    category?: { in: PostCategory[] };
    createdAt?: { gte: Date };
    authorId?: string;
  } = {};

  if (resolvedCategories) {
    where.category = { in: resolvedCategories };
  }

  if (params.since) {
    where.createdAt = { gte: sinceDate(params.since) };
  }

  if (params.authorId) {
    where.authorId = params.authorId;
  }

  const posts = await prisma.post.findMany({
    skip: params.offset,
    take: params.limit,
    where,
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
