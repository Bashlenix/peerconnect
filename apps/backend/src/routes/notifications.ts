import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sseManager } from "../modules/sse-manager.js";

interface NotifParams {
  id: string;
}

interface GetNotificationsQuery {
  limit?: number;
  offset?: number;
}

const NOTIFICATION_TYPES = [
  "NEW_POST_IN_CATEGORY",
  "REPLY_TO_POST",
  "REPLY_UPVOTED",
  "REPLY_MARKED_SOLUTION",
  "BADGE_AWARDED",
] as const;

const notificationSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: NOTIFICATION_TYPES },
    postId: { type: "string", nullable: true },
    replyId: { type: "string", nullable: true },
    isRead: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "type", "isRead", "createdAt"],
};

const errorSchema = {
  type: "object",
  properties: { message: { type: "string" } },
  required: ["message"],
};

function serializeNotification(n: {
  id: string;
  type: string;
  postId: string | null;
  replyId: string | null;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    postId: n.postId,
    replyId: n.replyId,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function notificationsRoute(app: FastifyInstance) {
  // ─── GET /notifications/stream ────────────────────────────────────────────

  app.get(
    "/notifications/stream",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Notifications"],
        summary: "Real-time SSE stream for the authenticated user",
        response: {
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;

      reply.hijack();
      const res = reply.raw;

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const connId = sseManager.register(userId, res);

      res.write("event: ping\ndata: {}\n\n");

      const timer = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          try {
            res.write("event: ping\ndata: {}\n\n");
          } catch {
            clearInterval(timer);
          }
        } else {
          clearInterval(timer);
        }
      }, 30_000);

      request.raw.on("close", () => {
        clearInterval(timer);
        sseManager.unregister(userId, connId);
      });
    }
  );

  // ─── GET /notifications ───────────────────────────────────────────────────

  app.get<{ Querystring: GetNotificationsQuery }>(
    "/notifications",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Notifications"],
        summary: "Get notification history for the current user (newest first)",
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
              notifications: { type: "array", items: notificationSchema },
              unreadCount: { type: "integer" },
            },
            required: ["notifications", "unreadCount"],
          },
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { limit = 20, offset = 0 } = request.query;

      const [notifications, unreadCount] = await prisma.$transaction([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            type: true,
            postId: true,
            replyId: true,
            isRead: true,
            createdAt: true,
          },
        }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      return reply.status(200).send({
        notifications: notifications.map(serializeNotification),
        unreadCount,
      });
    }
  );

  // ─── PATCH /notifications/read-all ───────────────────────────────────────

  app.patch(
    "/notifications/read-all",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
        response: {
          204: { type: "null" },
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return reply.status(204).send();
    }
  );

  // ─── PATCH /notifications/:id/read ───────────────────────────────────────

  app.patch<{ Params: NotifParams }>(
    "/notifications/:id/read",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Notifications"],
        summary: "Mark a notification as read",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: notificationSchema,
          401: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.userId;

      const notif = await prisma.notification.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });

      if (!notif) return reply.status(404).send({ message: "Notification not found" });
      if (notif.userId !== userId) return reply.status(403).send({ message: "Forbidden" });

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
        select: {
          id: true,
          type: true,
          postId: true,
          replyId: true,
          isRead: true,
          createdAt: true,
        },
      });

      return reply.status(200).send(serializeNotification(updated));
    }
  );
}
