import type { Prisma } from "../generated/prisma/client.js";

export type BadgeEvent = "REPLY_CREATED" | "UPVOTE_RECEIVED" | "SOLUTION_MARKED";

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

  if (event === "REPLY_CREATED") {
    const [replyCount, socialSportCount] = await Promise.all([
      tx.reply.count({ where: { authorId: userId } }),
      tx.reply.count({
        where: { authorId: userId, post: { category: { in: ["Social", "Sport"] } } },
      }),
    ]);
    if (replyCount >= 1) toCheck.push("First Reply");
    if (replyCount >= 3) toCheck.push("Getting Started");
    if (replyCount >= 10) toCheck.push("Active Helper");
    if (socialSportCount >= 10) toCheck.push("Community Builder");
  } else if (event === "UPVOTE_RECEIVED") {
    const upvoteCount = await tx.upvote.count({
      where: { reply: { authorId: userId } },
    });
    if (upvoteCount >= 5) toCheck.push("Helpful Contributor");
    if (upvoteCount >= 15) toCheck.push("Trusted Helper");
  } else if (event === "SOLUTION_MARKED") {
    const solutionCount = await tx.reply.count({
      where: { authorId: userId, isSolution: true },
    });
    if (solutionCount >= 5) toCheck.push("Solution Provider");
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
