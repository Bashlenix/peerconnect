import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { getFeedPosts } from "../modules/feed-query.js";
import type { SinceFilter, FeedResult } from "../modules/feed-query.js";
import { searchPosts } from "../modules/post-search.js";
import type { PostCategory } from "../generated/prisma/client.js";
import { checkAndAwardBadges } from "../modules/badge-engine.js";
import { dispatch } from "../modules/notifier.js";

const VALID_CATEGORIES = ["Academic", "Social", "Sport", "DailyLifeSupport"] as const;

interface CreatePostBody {
  content: string;
  category: string;
  isUrgent?: boolean;
}

interface GetPostsQuery {
  limit?: number;
  offset?: number;
  page?: number;
  category?: string;
  since?: string;
  subscribed?: boolean;
  authorId?: string;
}

interface SearchPostsQuery {
  q: string;
  limit?: number;
  offset?: number;
  category?: string;
  since?: string;
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
      nullable: true,
      type: "object",
      properties: {
        id: { type: "string" },
        firstName: { type: "string", nullable: true },
        lastName: { type: "string", nullable: true },
        topBadgeName: { type: "string", nullable: true },
      },
      required: ["id"],
    },
  },
  required: ["id", "content", "category", "isUrgent", "createdAt", "replyCount"],
};

function serializePost(post: {
  id: string;
  content: string;
  category: string;
  isUrgent: boolean;
  createdAt: Date;
  editedAt: Date | null;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    topBadgeName: string | null;
  } | null;
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
          author: { select: { id: true, firstName: true, lastName: true, topBadgeName: true } },
          _count: { select: { replies: true } },
        },
      });

      void dispatch({ type: "NEW_POST_IN_CATEGORY", postId: post.id, category, authorId });

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
            page: { type: "integer", minimum: 1, description: "1-based page number (overrides offset when provided)" },
            category: { type: "string", enum: VALID_CATEGORIES },
            since: { type: "string", enum: ["24h", "3d", "7d"] },
            subscribed: { type: "boolean" },
            authorId: { type: "string", description: "Filter posts by author UUID" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              posts: { type: "array", items: postSchema },
              total: { type: "integer" },
            },
            required: ["posts", "total"],
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
      const { limit = 20, offset = 0, page, category, since, subscribed, authorId } = request.query;

      const { posts, total }: FeedResult = await getFeedPosts(prisma, {
        limit,
        offset,
        page,
        category: category as PostCategory | undefined,
        since: since as SinceFilter | undefined,
        subscribed,
        userId: request.user.userId,
        authorId,
      });

      return reply.status(200).send({ posts: posts.map(serializePost), total });
    }
  );

  // ─── GET /posts/search ───────────────────────────────────────────────────

  app.get<{ Querystring: SearchPostsQuery }>(
    "/posts/search",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Posts"],
        summary: "Full-text search posts ranked by relevance",
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            offset: { type: "integer", minimum: 0, default: 0 },
            category: { type: "string", enum: VALID_CATEGORIES },
            since: { type: "string", enum: ["24h", "3d", "7d"] },
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
          400: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
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
      const { q, limit = 20, offset = 0, category, since } = request.query;
      const posts = await searchPosts(prisma, {
        q,
        limit,
        offset,
        category: category as PostCategory | undefined,
        since: since as SinceFilter | undefined,
      });
      return reply.status(200).send({ posts: posts.map(serializePost) });
    }
  );

  // ─── GET /posts/:id ──────────────────────────────────────────────────────

  app.get<{ Params: PostParamsOnly }>(
    "/posts/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Posts"],
        summary: "Get a single post by ID",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: postSchema,
          401: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
          404: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const post = await prisma.post.findUnique({
        where: { id },
        select: {
          id: true,
          content: true,
          category: true,
          isUrgent: true,
          createdAt: true,
          editedAt: true,
          author: { select: { id: true, firstName: true, lastName: true, topBadgeName: true } },
          _count: { select: { replies: true } },
        },
      });

      if (!post) return reply.status(404).send({ message: "Post not found" });

      return reply.status(200).send(
        serializePost({
          ...post,
          category: post.category as string,
          replyCount: post._count.replies,
        })
      );
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
          author: { select: { id: true, firstName: true, lastName: true, topBadgeName: true } },
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
        select: { id: true, authorId: true },
      });
      if (!replyRecord) return reply.status(404).send({ message: "Reply not found" });

      const replyAuthorId = replyRecord.authorId;

      const newBadges = await prisma.$transaction(async (tx) => {
        await tx.reply.updateMany({ where: { postId, isSolution: true }, data: { isSolution: false } });
        await tx.reply.update({ where: { id: replyId }, data: { isSolution: true } });
        if (!replyAuthorId) return [];
        return checkAndAwardBadges(tx, replyAuthorId, "SOLUTION_MARKED");
      });

      if (replyAuthorId) {
        void dispatch({ type: "REPLY_MARKED_SOLUTION", postId, replyId, replyAuthorId, markerId: userId });
        for (const badge of newBadges) {
          void dispatch({ type: "BADGE_AWARDED", userId: replyAuthorId, badge });
        }
      }

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
