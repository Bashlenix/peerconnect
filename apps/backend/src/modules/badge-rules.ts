import type { Prisma, PostCategory } from "../generated/prisma/client.js";
import { BADGE_NAMES, type BadgeEvent } from "@peerconnect/shared";

export interface BadgeRule {
  name: string;
  description: string;
  event: BadgeEvent;
  check: (tx: Prisma.TransactionClient, userId: string) => Promise<boolean>;
}

export const BADGE_RULES: BadgeRule[] = [
  {
    name: BADGE_NAMES.FIRST_REPLY,
    description: "Posted your first reply",
    event: "REPLY_CREATED",
    check: (tx, userId) =>
      tx.reply.count({ where: { authorId: userId } }).then((n) => n >= 1),
  },
  {
    name: BADGE_NAMES.GETTING_STARTED,
    description: "Posted 3 replies",
    event: "REPLY_CREATED",
    check: (tx, userId) =>
      tx.reply.count({ where: { authorId: userId } }).then((n) => n >= 3),
  },
  {
    name: BADGE_NAMES.ACTIVE_HELPER,
    description: "Posted 10 or more replies",
    event: "REPLY_CREATED",
    check: (tx, userId) =>
      tx.reply.count({ where: { authorId: userId } }).then((n) => n >= 10),
  },
  {
    name: BADGE_NAMES.COMMUNITY_BUILDER,
    description: "Posted 10 or more replies in Social or Sport categories",
    event: "REPLY_CREATED",
    check: (tx, userId) =>
      tx.reply
        .count({
          where: {
            authorId: userId,
            post: { category: { in: ["Social", "Sport"] as PostCategory[] } },
          },
        })
        .then((n) => n >= 10),
  },
  {
    name: BADGE_NAMES.HELPFUL_CONTRIBUTOR,
    description: "Received 5 upvotes on your replies",
    event: "UPVOTE_RECEIVED",
    check: (tx, userId) =>
      tx.upvote.count({ where: { reply: { authorId: userId } } }).then((n) => n >= 5),
  },
  {
    name: BADGE_NAMES.TRUSTED_HELPER,
    description: "Received 15 upvotes on your replies",
    event: "UPVOTE_RECEIVED",
    check: (tx, userId) =>
      tx.upvote.count({ where: { reply: { authorId: userId } } }).then((n) => n >= 15),
  },
  {
    name: BADGE_NAMES.SOLUTION_PROVIDER,
    description: "Had 5 replies marked as the accepted solution",
    event: "SOLUTION_MARKED",
    check: (tx, userId) =>
      tx.reply
        .count({ where: { authorId: userId, isSolution: true } })
        .then((n) => n >= 5),
  },
];
