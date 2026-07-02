import type { Prisma } from "../generated/prisma/client.js";
import { BADGE_RULES, type BadgeEvent, type BadgeRule } from "./badge-config.js";

export type { BadgeEvent };

export interface AwardedBadge {
  badgeId: string;
  name: string;
  description: string;
}

export async function checkAndAwardBadges(
  tx: Prisma.TransactionClient,
  userId: string,
  event: BadgeEvent
): Promise<AwardedBadge[]> {
  const existing = await tx.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const ownedIds = new Set(existing.map((b) => b.badgeId));

  const toCheck: string[] = [];
  const rulesForEvent = BADGE_RULES.filter((r) => r.event === event);

  const filterKey = (cats: string[] | undefined) =>
    cats ? [...cats].sort().join(",") : "";

  if (event === "REPLY_CREATED") {
    // Deduplicate count queries by category filter set (empty key = no filter)
    const uniqueFilters = new Map<string, BadgeRule["categoryFilter"]>();
    for (const rule of rulesForEvent) {
      uniqueFilters.set(filterKey(rule.categoryFilter), rule.categoryFilter);
    }

    const countResults = await Promise.all(
      [...uniqueFilters.values()].map((cats) =>
        cats
          ? tx.reply.count({ where: { authorId: userId, post: { category: { in: cats } } } })
          : tx.reply.count({ where: { authorId: userId } })
      )
    );

    const countMap = new Map(
      [...uniqueFilters.keys()].map((key, i) => [key, countResults[i]!])
    );

    for (const rule of rulesForEvent) {
      if ((countMap.get(filterKey(rule.categoryFilter)) ?? 0) >= rule.threshold) {
        toCheck.push(rule.name);
      }
    }
  } else if (event === "UPVOTE_RECEIVED") {
    const upvoteCount = await tx.upvote.count({
      where: { reply: { authorId: userId } },
    });
    for (const rule of rulesForEvent) {
      if (upvoteCount >= rule.threshold) toCheck.push(rule.name);
    }
  } else if (event === "SOLUTION_MARKED") {
    const solutionCount = await tx.reply.count({
      where: { authorId: userId, isSolution: true },
    });
    for (const rule of rulesForEvent) {
      if (solutionCount >= rule.threshold) toCheck.push(rule.name);
    }
  }

  if (toCheck.length === 0) return [];

  const badges = await tx.badge.findMany({
    where: { name: { in: toCheck } },
    select: { id: true, name: true, description: true },
  });

  const newBadges = badges.filter((b) => !ownedIds.has(b.id));
  if (newBadges.length === 0) return [];

  await tx.userBadge.createMany({
    data: newBadges.map((b) => ({ userId, badgeId: b.id })),
  });

  return newBadges.map((b) => ({ badgeId: b.id, name: b.name, description: b.description }));
}
