import type { PrismaClient } from "../generated/prisma/client.js";

export interface ReplyItem {
  id: string;
  content: string;
  isSolution: boolean;
  createdAt: Date;
  editedAt: Date | null;
  upvoteCount: number;
  author: { id: string; firstName: string | null; lastName: string | null };
}

export async function getReplies(prisma: PrismaClient, postId: string): Promise<ReplyItem[]> {
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

  return replies.map((r) => ({
    id: r.id,
    content: r.content,
    isSolution: r.isSolution,
    createdAt: r.createdAt,
    editedAt: r.editedAt,
    upvoteCount: r._count.upvotes,
    author: r.author,
  }));
}
