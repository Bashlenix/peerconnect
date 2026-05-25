import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import type { NotificationType } from "../generated/prisma/client.js";
import { getReplies } from "../modules/reply-query.js";
import { sseManager } from "../modules/sse-manager.js";
import { checkAndAwardBadges, type AwardedBadge } from "../modules/badge-engine.js";

interface PostParams {
  id: string;
}

interface ReplyParams {
  id: string;
}

interface CreateReplyBody {
  content: string;
}

interface UpdateReplyBody {
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
    hasUpvoted: { type: "boolean" },
    author: {
      nullable: true,
      type: "object",
      properties: {
        id: { type: "string" },
        firstName: { type: "string", nullable: true },
        lastName: { type: "string", nullable: true },
      },
      required: ["id"],
    },
  },
  required: ["id", "content", "isSolution", "createdAt", "upvoteCount", "hasUpvoted"],
};

const errorSchema = {
  type: "object",
  properties: { message: { type: "string" } },
  required: ["message"],
};

function serializeReply(reply: {
  id: string;
  content: string;
  isSolution: boolean;
  createdAt: Date;
  editedAt: Date | null;
  upvoteCount: number;
  hasUpvoted: boolean;
  author: { id: string; firstName: string | null; lastName: string | null } | null;
}) {
  return {
    id: reply.id,
    content: reply.content,
    isSolution: reply.isSolution,
    createdAt: reply.createdAt.toISOString(),
    editedAt: reply.editedAt?.toISOString() ?? null,
    upvoteCount: reply.upvoteCount,
    hasUpvoted: reply.hasUpvoted,
    author: reply.author,
  };
}

function fireBadgeNotifications(userId: string, badges: AwardedBadge[]): void {
  for (const badge of badges) {
    void (async () => {
      const notif = await prisma.notification.create({
        data: { userId, type: "BADGE_AWARDED" as NotificationType },
        select: { id: true },
      });
      sseManager.push(userId, "notification", { type: "BADGE_AWARDED", notificationId: notif.id });
      sseManager.push(userId, "badge_awarded", { name: badge.name, description: badge.description });
    })().catch(() => {});
  }
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
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: postId } = request.params;
      const userId = request.user.userId;

      const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!post) return reply.status(404).send({ message: "Post not found" });

      const replies = await getReplies(prisma, postId, userId);
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
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: postId } = request.params;
      const { content } = request.body;
      const authorId = request.user.userId;

      const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
      if (!post) return reply.status(404).send({ message: "Post not found" });

      const [created, newBadges] = await prisma.$transaction(async (tx) => {
        const c = await tx.reply.create({
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
        const badges = await checkAndAwardBadges(tx, authorId, "REPLY_CREATED");
        return [c, badges] as const;
      });

      // Notify the post author if they didn't reply to their own post and if post author exists
      if (post.authorId && post.authorId !== authorId) {
        const postAuthorId = post.authorId;
        void (async () => {
          const notif = await prisma.notification.create({
            data: {
              userId: postAuthorId,
              type: "REPLY_TO_POST" as NotificationType,
              postId,
              replyId: created.id,
            },
            select: { id: true },
          });
          sseManager.push(postAuthorId, "notification", {
            type: "REPLY_TO_POST",
            notificationId: notif.id,
          });
        })();
      }

      fireBadgeNotifications(authorId, newBadges);

      return reply.status(201).send(
        serializeReply({ ...created, upvoteCount: created._count.upvotes, hasUpvoted: false })
      );
    }
  );

  // ─── POST /replies/:id/upvote ─────────────────────────────────────────────

  app.post<{ Params: ReplyParams }>(
    "/replies/:id/upvote",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Replies"],
        summary: "Upvote a reply",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          201: {
            type: "object",
            properties: { upvoteCount: { type: "integer" } },
            required: ["upvoteCount"],
          },
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: replyId } = request.params;
      const userId = request.user.userId;

      const existing = await prisma.reply.findUnique({
        where: { id: replyId },
        select: { id: true, authorId: true, postId: true },
      });
      if (!existing) return reply.status(404).send({ message: "Reply not found" });

      type UpvoteResult =
        | { alreadyUpvoted: true }
        | { upvoteCount: number; newBadges: AwardedBadge[] };

      const result: UpvoteResult = await prisma.$transaction(async (tx) => {
        try {
          await tx.upvote.create({ data: { userId, replyId } });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            return { alreadyUpvoted: true as const };
          }
          throw e;
        }
        const newBadges = existing.authorId
          ? await checkAndAwardBadges(tx, existing.authorId, "UPVOTE_RECEIVED")
          : [];
        const count = await tx.upvote.count({ where: { replyId } });
        return { upvoteCount: count, newBadges };
      });

      if ("alreadyUpvoted" in result) {
        return reply.status(409).send({ message: "Already upvoted" });
      }

      const { upvoteCount, newBadges } = result;

      // Notify the reply author if they didn't upvote their own reply and reply author exists
      if (existing.authorId && existing.authorId !== userId) {
        const replyAuthorId = existing.authorId;
        void (async () => {
          const notif = await prisma.notification.create({
            data: {
              userId: replyAuthorId,
              type: "REPLY_UPVOTED" as NotificationType,
              postId: existing.postId,
              replyId,
            },
            select: { id: true },
          });
          sseManager.push(replyAuthorId, "notification", {
            type: "REPLY_UPVOTED",
            notificationId: notif.id,
          });
        })();
      }

      if (existing.authorId) {
        fireBadgeNotifications(existing.authorId, newBadges);
      }

      return reply.status(201).send({ upvoteCount });
    }
  );

  // ─── DELETE /replies/:id/upvote ───────────────────────────────────────────

  app.delete<{ Params: ReplyParams }>(
    "/replies/:id/upvote",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Replies"],
        summary: "Remove upvote from a reply",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          204: { type: "null" },
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: replyId } = request.params;
      const userId = request.user.userId;

      const existing = await prisma.reply.findUnique({ where: { id: replyId }, select: { id: true } });
      if (!existing) return reply.status(404).send({ message: "Reply not found" });

      try {
        await prisma.upvote.delete({ where: { userId_replyId: { userId, replyId } } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
          return reply.status(404).send({ message: "Upvote not found" });
        }
        throw e;
      }

      return reply.status(204).send();
    }
  );

  // ─── PATCH /replies/:id ───────────────────────────────────────────────────

  app.patch<{ Params: ReplyParams; Body: UpdateReplyBody }>(
    "/replies/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Replies"],
        summary: "Edit a reply",
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
          200: replySchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { content } = request.body;
      const userId = request.user.userId;

      const existing = await prisma.reply.findUnique({
        where: { id },
        select: { id: true, authorId: true },
      });
      if (!existing) return reply.status(404).send({ message: "Reply not found" });
      if (existing.authorId !== userId) return reply.status(403).send({ message: "Forbidden" });

      const updated = await prisma.reply.update({
        where: { id },
        data: { content, editedAt: new Date() },
        select: {
          id: true,
          content: true,
          isSolution: true,
          createdAt: true,
          editedAt: true,
          _count: { select: { upvotes: true } },
          upvotes: { where: { userId }, select: { id: true } },
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return reply.status(200).send(
        serializeReply({
          ...updated,
          upvoteCount: updated._count.upvotes,
          hasUpvoted: updated.upvotes.length > 0,
        })
      );
    }
  );

  // ─── DELETE /replies/:id ──────────────────────────────────────────────────

  app.delete<{ Params: ReplyParams }>(
    "/replies/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Replies"],
        summary: "Delete a reply",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          204: { type: "null" },
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.userId;

      const existing = await prisma.reply.findUnique({
        where: { id },
        select: { id: true, authorId: true, isSolution: true },
      });
      if (!existing) return reply.status(404).send({ message: "Reply not found" });
      if (existing.authorId !== userId) return reply.status(403).send({ message: "Forbidden" });
      if (existing.isSolution) return reply.status(409).send({ message: "Cannot delete an accepted solution" });

      await prisma.reply.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
