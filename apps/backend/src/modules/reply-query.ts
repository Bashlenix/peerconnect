import type { PrismaClient } from "../generated/prisma/client.js";

export interface ReplyItem {
  id: string;
  content: string;
  isSolution: boolean;
  createdAt: Date;
  editedAt: Date | null;
  upvoteCount: number;
  hasUpvoted: boolean;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    topBadgeName: string | null;
  } | null;
}

export async function getReplies(
  prisma: PrismaClient,
  postId: string,
  userId: string
): Promise<ReplyItem[]> {
  const replies = await prisma.reply.findMany({
    where: { postId },
    orderBy: [
      { isSolution: "desc" },
      { upvotes: { _count: "desc" } },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      content: true,
      isSolution: true,
      createdAt: true,
      editedAt: true,
      _count: { select: { upvotes: true } },
      upvotes: { where: { userId }, select: { userId: true } },
      author: { select: { id: true, firstName: true, lastName: true, topBadgeName: true } },
    },
  });

  return replies.map((r) => ({
    id: r.id,
    content: r.content,
    isSolution: r.isSolution,
    createdAt: r.createdAt,
    editedAt: r.editedAt,
    upvoteCount: r._count.upvotes,
    hasUpvoted: r.upvotes.length > 0,
    author: r.author,
  }));
}
