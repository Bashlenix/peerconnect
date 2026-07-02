import type { Prisma } from "../generated/prisma/client.js";
import { BADGE_METADATA, type BadgeEvent } from "@peerconnect/shared";
import { BADGE_RULES } from "./badge-rules.js";

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

  const rulesForEvent = BADGE_RULES.filter((r) => r.event === event);
  const results = await Promise.all(rulesForEvent.map((r) => r.check(tx, userId)));

  const eligible = rulesForEvent
    .filter((_, i) => results[i])
    .map((r) => r.name);

  if (eligible.length === 0) return [];

  const badges = await tx.badge.findMany({
    where: { name: { in: eligible } },
    select: { id: true, name: true, description: true },
  });

  const newBadges = badges.filter((b) => !ownedIds.has(b.id));
  if (newBadges.length === 0) return [];

  await tx.userBadge.createMany({
    data: newBadges.map((b) => ({ userId, badgeId: b.id })),
  });

  await updateTopBadge(tx, userId, newBadges.map((b) => b.name));

  return newBadges.map((b) => ({ badgeId: b.id, name: b.name, description: b.description }));
}

function rankOf(name: string | null): number {
  return name ? (BADGE_METADATA[name]?.rank ?? -1) : -1;
}

async function updateTopBadge(
  tx: Prisma.TransactionClient,
  userId: string,
  newBadgeNames: string[]
): Promise<void> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { topBadgeName: true },
  });

  const best = newBadgeNames.reduce<string | null>(
    (top, name) => (rankOf(name) > rankOf(top) ? name : top),
    user.topBadgeName
  );

  if (best !== user.topBadgeName) {
    await tx.user.update({
      where: { id: userId },
      data: { topBadgeName: best, topBadgeAwardedAt: new Date() },
    });
  }
}
