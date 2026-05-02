import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { getFeedPosts } from "../modules/feed-query.js";
import type { PostCategory } from "../generated/prisma/client.js";

const VALID_CATEGORIES = ["Academic", "Social", "Sport", "DailyLifeSupport"] as const;

interface CreatePostBody {
  content: string;
  category: string;
  isUrgent?: boolean;
}

interface GetPostsQuery {
  limit?: number;
  offset?: number;
}

interface PostParamsOnly {
  id: string;
}

interface UpdatePostBody {
  content: string;
}

interface SetSolutionBody {
  replyId: string;
}

const postSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    content: { type: "string" },
    category: { type: "string" },
    isUrgent: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    editedAt: { type: "string", format: "date-time", nullable: true },
    replyCount: { type: "integer" },
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
  required: ["id", "content", "category", "isUrgent", "createdAt", "replyCount", "author"],
};

function serializePost(post: {
  id: string;
  content: string;
  category: string;
  isUrgent: boolean;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; firstName: string | null; lastName: string | null };
  replyCount: number;
}) {
  return {
    id: post.id,
    content: post.content,
    category: post.category,
    isUrgent: post.isUrgent,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt?.toISOString() ?? null,
    author: post.author,
    replyCount: post.replyCount,
  };
}

export async function postsRoute(app: FastifyInstance) {
  // ─── POST /posts ──────────────────────────────────────────────────────────

  app.post<{ Body: CreatePostBody }>(
    "/posts",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Posts"],
        summary: "Create a new post",
        body: {
          type: "object",
          required: ["content", "category"],
          properties: {
            content: { type: "string", minLength: 1 },
            category: { type: "string", enum: VALID_CATEGORIES },
            isUrgent: { type: "boolean" },
          },
        },
        response: {
          201: postSchema,
          401: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { content, category, isUrgent = false } = request.body;
      const authorId = request.user.userId;

      const post = await prisma.post.create({
        data: {
          content,
          category: category as PostCategory,
          isUrgent,
          authorId,
        },
        select: {
          id: true,
          content: true,
          category: true,
          isUrgent: true,
          createdAt: true,
          editedAt: true,
          author: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { replies: true } },
        },
      });

      return reply.status(201).send(
        serializePost({
          ...post,
          category: post.category as string,
          replyCount: post._count.replies,
        })
      );
    }
  );

  // ─── GET /posts ───────────────────────────────────────────────────────────

  app.get<{ Querystring: GetPostsQuery }>(
    "/posts",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Posts"],
        summary: "Get feed posts in reverse-chronological order",
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              posts: { type: "array", items: postSchema },
            },
            required: ["posts"],
          },
          401: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { limit = 20, offset = 0 } = request.query;
      const posts = await getFeedPosts(prisma, { limit, offset });
      return reply.status(200).send({ posts: posts.map(serializePost) });
    }
  );

  // ─── PATCH /posts/:id ────────────────────────────────────────────────────

  app.patch<{ Params: PostParamsOnly; Body: UpdatePostBody }>(
    "/posts/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Posts"],
        summary: "Edit a post's content",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["content"],
          properties: { content: { type: "string", minLength: 1 } },
        },
        response: {
          200: postSchema,
          401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          403: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          404: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { content } = request.body;
      const userId = request.user.userId;

      const post = await prisma.post.findUnique({
        where: { id },
        select: { id: true, authorId: true },
      });
      if (!post) return reply.status(404).send({ message: "Post not found" });
      if (post.authorId !== userId) return reply.status(403).send({ message: "Forbidden" });

      const updated = await prisma.post.update({
        where: { id },
        data: { content, editedAt: new Date() },
        select: {
          id: true,
          content: true,
          category: true,
          isUrgent: true,
          createdAt: true,
          editedAt: true,
          author: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { replies: true } },
        },
      });

      return reply.status(200).send(
        serializePost({
          ...updated,
          category: updated.category as string,
          replyCount: updated._count.replies,
        })
      );
    }
  );

  // ─── DELETE /posts/:id ────────────────────────────────────────────────────

  app.delete<{ Params: PostParamsOnly }>(
    "/posts/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Posts"],
        summary: "Delete a post (only allowed when it has no replies)",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          204: { type: "null" },
          401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          403: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          404: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          409: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.userId;

      const post = await prisma.post.findUnique({
        where: { id },
        select: { id: true, authorId: true, _count: { select: { replies: true } } },
      });
      if (!post) return reply.status(404).send({ message: "Post not found" });
      if (post.authorId !== userId) return reply.status(403).send({ message: "Forbidden" });
      if (post._count.replies > 0) return reply.status(409).send({ message: "Cannot delete a post that has replies" });

      await prisma.post.delete({ where: { id } });
      return reply.status(204).send();
    }
  );

  // ─── PATCH /posts/:id/solution ────────────────────────────────────────────

  app.patch<{ Params: PostParamsOnly; Body: SetSolutionBody }>(
    "/posts/:id/solution",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Posts"],
        summary: "Mark a reply as the accepted solution for a post",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["replyId"],
          properties: { replyId: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: { replyId: { type: "string" } },
            required: ["replyId"],
          },
          401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          403: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          404: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
        },
      },
    },
    async (request, reply) => {
      const { id: postId } = request.params;
      const { replyId } = request.body;
      const userId = request.user.userId;

      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true },
      });
      if (!post) return reply.status(404).send({ message: "Post not found" });
      if (post.authorId !== userId) return reply.status(403).send({ message: "Forbidden" });

      const replyRecord = await prisma.reply.findFirst({
        where: { id: replyId, postId },
        select: { id: true },
      });
      if (!replyRecord) return reply.status(404).send({ message: "Reply not found" });

      await prisma.$transaction([
        prisma.reply.updateMany({ where: { postId, isSolution: true }, data: { isSolution: false } }),
        prisma.reply.update({ where: { id: replyId }, data: { isSolution: true } }),
      ]);

      return reply.status(200).send({ replyId });
    }
  );

  // ─── DELETE /posts/:id/solution ───────────────────────────────────────────

  app.delete<{ Params: PostParamsOnly }>(
    "/posts/:id/solution",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Posts"],
        summary: "Unmark the accepted solution for a post",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          204: { type: "null" },
          401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          403: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          404: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
        },
      },
    },
    async (request, reply) => {
      const { id: postId } = request.params;
      const userId = request.user.userId;

      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true },
      });
      if (!post) return reply.status(404).send({ message: "Post not found" });
      if (post.authorId !== userId) return reply.status(403).send({ message: "Forbidden" });

      await prisma.reply.updateMany({ where: { postId, isSolution: true }, data: { isSolution: false } });
      return reply.status(204).send();
    }
  );
}
