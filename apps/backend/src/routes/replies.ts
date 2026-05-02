import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { getReplies } from "../modules/reply-query.js";

interface PostParams {
  id: string;
}

interface CreateReplyBody {
  content: string;
}

const replySchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    content: { type: "string" },
    isSolution: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    editedAt: { type: "string", format: "date-time", nullable: true },
    upvoteCount: { type: "integer" },
    author: {
      type: "object",
      properties: {
        id: { type: "string" },
        firstName: { type: "string", nullable: true },
        lastName: { type: "string", nullable: true },
      },
      required: ["id"],
    },
  },
  required: ["id", "content", "isSolution", "createdAt", "upvoteCount", "author"],
};

function serializeReply(reply: {
  id: string;
  content: string;
  isSolution: boolean;
  createdAt: Date;
  editedAt: Date | null;
  upvoteCount: number;
  author: { id: string; firstName: string | null; lastName: string | null };
}) {
  return {
    id: reply.id,
    content: reply.content,
    isSolution: reply.isSolution,
    createdAt: reply.createdAt.toISOString(),
    editedAt: reply.editedAt?.toISOString() ?? null,
    upvoteCount: reply.upvoteCount,
    author: reply.author,
  };
}

export async function repliesRoute(app: FastifyInstance) {
  // ─── GET /posts/:id/replies ───────────────────────────────────────────────

  app.get<{ Params: PostParams }>(
    "/posts/:id/replies",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Replies"],
        summary: "Get replies for a post sorted by solution, upvotes, then oldest first",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              replies: { type: "array", items: replySchema },
            },
            required: ["replies"],
          },
          401: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
          404: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { id: postId } = request.params;

      const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!post) return reply.status(404).send({ message: "Post not found" });

      const replies = await getReplies(prisma, postId);
      return reply.status(200).send({ replies: replies.map(serializeReply) });
    }
  );

  // ─── POST /posts/:id/replies ──────────────────────────────────────────────

  app.post<{ Params: PostParams; Body: CreateReplyBody }>(
    "/posts/:id/replies",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Replies"],
        summary: "Add a reply to a post",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string", minLength: 1 },
          },
        },
        response: {
          201: replySchema,
          401: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
          404: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { id: postId } = request.params;
      const { content } = request.body;
      const authorId = request.user.userId;

      const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!post) return reply.status(404).send({ message: "Post not found" });

      const created = await prisma.reply.create({
        data: { content, authorId, postId },
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

      return reply.status(201).send(
        serializeReply({ ...created, upvoteCount: created._count.upvotes })
      );
    }
  );
}
