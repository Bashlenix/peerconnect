import type { PrismaClient } from "../generated/prisma/client.js";

export interface ReplyItem {
  id: string;
  content: string;
  isSolution: boolean;
  createdAt: Date;
  editedAt: Date | null;
  upvoteCount: number;
  hasUpvoted: boolean;
  author: { id: string; firstName: string | null; lastName: string | null } | null;
}

export async function getReplies(
  prisma: PrismaClient,
  postId: string,
  userId?: string
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
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  let upvotedReplyIds = new Set<string>();
  if (userId && replies.length > 0) {
    const upvotes = await prisma.upvote.findMany({
      where: { userId, replyId: { in: replies.map((r) => r.id) } },
      select: { replyId: true },
    });
    upvotedReplyIds = new Set(upvotes.map((u) => u.replyId));
  }

  return replies.map((r) => ({
    id: r.id,
    content: r.content,
    isSolution: r.isSolution,
    createdAt: r.createdAt,
    editedAt: r.editedAt,
    upvoteCount: r._count.upvotes,
    hasUpvoted: upvotedReplyIds.has(r.id),
    author: r.author,
  }));
}
