import type { PostCategory, NotificationType } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { sseManager } from "./sse-manager.js";
import { logger } from "../logger.js";

export type NotificationEvent =
  | { type: "NEW_POST_IN_CATEGORY"; postId: string; category: string; authorId: string }
  | { type: "REPLY_TO_POST"; postId: string; replyId: string; postAuthorId: string; replyAuthorId: string }
  | { type: "REPLY_UPVOTED"; postId: string; replyId: string; replyAuthorId: string; voterId: string }
  | { type: "REPLY_MARKED_SOLUTION"; postId: string; replyId: string; replyAuthorId: string; markerId: string }
  | { type: "BADGE_AWARDED"; userId: string; badge: { name: string; description: string } };

export async function dispatch(event: NotificationEvent): Promise<void> {
  try {
    switch (event.type) {
      case "NEW_POST_IN_CATEGORY": {
        const { postId, category, authorId } = event;
        const prefs = await prisma.notificationPreference.findMany({
          where: { category: category as PostCategory, NOT: { userId: authorId } },
          select: { userId: true },
        });
        if (prefs.length === 0) return;
        await prisma.notification.createMany({
          data: prefs.map((p) => ({
            userId: p.userId,
            type: "NEW_POST_IN_CATEGORY" as NotificationType,
            postId,
          })),
        });
        for (const { userId } of prefs) {
          sseManager.push(userId, "notification", { type: "NEW_POST_IN_CATEGORY" });
        }
        break;
      }

      case "REPLY_TO_POST": {
        const { postId, replyId, postAuthorId, replyAuthorId } = event;
        if (postAuthorId === replyAuthorId) return;
        const notif = await prisma.notification.create({
          data: { userId: postAuthorId, type: "REPLY_TO_POST" as NotificationType, postId, replyId },
          select: { id: true },
        });
        sseManager.push(postAuthorId, "notification", { type: "REPLY_TO_POST", notificationId: notif.id });
        break;
      }

      case "REPLY_UPVOTED": {
        const { postId, replyId, replyAuthorId, voterId } = event;
        if (replyAuthorId === voterId) return;
        const notif = await prisma.notification.create({
          data: { userId: replyAuthorId, type: "REPLY_UPVOTED" as NotificationType, postId, replyId },
          select: { id: true },
        });
        sseManager.push(replyAuthorId, "notification", { type: "REPLY_UPVOTED", notificationId: notif.id });
        break;
      }

      case "REPLY_MARKED_SOLUTION": {
        const { postId, replyId, replyAuthorId, markerId } = event;
        if (replyAuthorId === markerId) return;
        const notif = await prisma.notification.create({
          data: { userId: replyAuthorId, type: "REPLY_MARKED_SOLUTION" as NotificationType, postId, replyId },
          select: { id: true },
        });
        sseManager.push(replyAuthorId, "notification", { type: "REPLY_MARKED_SOLUTION", notificationId: notif.id });
        break;
      }

      case "BADGE_AWARDED": {
        const { userId, badge } = event;
        const notif = await prisma.notification.create({
          data: { userId, type: "BADGE_AWARDED" as NotificationType },
          select: { id: true },
        });
        sseManager.push(userId, "notification", { type: "BADGE_AWARDED", notificationId: notif.id });
        sseManager.push(userId, "badge_awarded", { name: badge.name, description: badge.description });
        break;
      }
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "notifier dispatch failed");
  }
}
