import type { Prisma } from "../generated/prisma/client.js";
import { BADGE_METADATA } from "@peerconnect/shared";

export interface BackfillResult {
  updatedCount: number;
}

export async function backfillTopBadges(
  client: Prisma.TransactionClient
): Promise<BackfillResult> {
  const users = await client.user.findMany({
    select: {
      id: true,
      userBadges: {
        select: { awardedAt: true, badge: { select: { name: true } } },
      },
    },
  });

  let updatedCount = 0;

  for (const user of users) {
    if (user.userBadges.length === 0) continue;

    const top = user.userBadges.reduce((best, candidate) => {
      const candidateRank = BADGE_METADATA[candidate.badge.name]?.rank ?? -1;
      const bestRank = BADGE_METADATA[best.badge.name]?.rank ?? -1;
      return candidateRank > bestRank ? candidate : best;
    });

    await client.user.update({
      where: { id: user.id },
      data: { topBadgeName: top.badge.name, topBadgeAwardedAt: top.awardedAt },
    });
    updatedCount++;
  }

  return { updatedCount };
}
