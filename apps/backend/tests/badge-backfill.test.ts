import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";
import { backfillTopBadges } from "../src/modules/badge-backfill.js";

const TEST_DB_URL =
  process.env["DATABASE_URL"] ?? "postgresql://bashi@localhost:5432/peerconnect_test";

let pool: Pool;
let prisma: PrismaClient;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
  await seedReferenceData(prisma);
});

afterAll(async () => {
  await pool.query(
    `TRUNCATE TABLE user_badges, notification_preferences, notifications,
                   upvotes, replies, posts, subscriptions, users,
                   badges, universities CASCADE`
  );
  await prisma.$disconnect();
  await pool.end();
});

afterEach(async () => {
  await pool.query("DELETE FROM users");
});

async function createUserWithBadges(email: string, badgeNames: string[]) {
  const badges = await prisma.badge.findMany({ where: { name: { in: badgeNames } } });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: "hash",
      isVerified: true,
      userBadges: {
        create: badges.map((b) => ({ badgeId: b.id })),
      },
    },
    select: { id: true },
  });
  return user.id;
}

describe("backfillTopBadges", () => {
  it("sets topBadgeName to the single badge a user has earned", async () => {
    const userId = await createUserWithBadges("backfill-single@tu-berlin.de", ["First Reply"]);

    await backfillTopBadges(prisma);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.topBadgeName).toBe("First Reply");
    expect(user.topBadgeAwardedAt).not.toBeNull();
  });

  it("picks the highest-rank badge among several earned badges", async () => {
    const userId = await createUserWithBadges("backfill-multi@tu-berlin.de", [
      "First Reply",
      "Trusted Helper",
      "Getting Started",
    ]);

    await backfillTopBadges(prisma);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.topBadgeName).toBe("Trusted Helper");
  });

  it("sets topBadgeAwardedAt to the actual awardedAt of the top badge, not the current time", async () => {
    const badge = await prisma.badge.findUniqueOrThrow({ where: { name: "Solution Provider" } });
    const historicalDate = new Date("2020-01-01T00:00:00.000Z");
    const user = await prisma.user.create({
      data: {
        email: "backfill-historical@tu-berlin.de",
        passwordHash: "hash",
        isVerified: true,
        userBadges: { create: { badgeId: badge.id, awardedAt: historicalDate } },
      },
      select: { id: true },
    });

    await backfillTopBadges(prisma);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.topBadgeAwardedAt).toStrictEqual(historicalDate);
  });

  it("leaves topBadgeName null for a user with no badges", async () => {
    const user = await prisma.user.create({
      data: { email: "backfill-none@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    await backfillTopBadges(prisma);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.topBadgeName).toBeNull();
  });

  it("is idempotent — running it twice produces the same result", async () => {
    const userId = await createUserWithBadges("backfill-idempotent@tu-berlin.de", [
      "Helpful Contributor",
      "Solution Provider",
    ]);

    await backfillTopBadges(prisma);
    const first = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    await backfillTopBadges(prisma);
    const second = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    expect(second.topBadgeName).toBe(first.topBadgeName);
    expect(second.topBadgeAwardedAt).toStrictEqual(first.topBadgeAwardedAt);
  });

  it("returns the count of users updated", async () => {
    await createUserWithBadges("backfill-count-1@tu-berlin.de", ["First Reply"]);
    await createUserWithBadges("backfill-count-2@tu-berlin.de", ["Getting Started"]);
    await prisma.user.create({
      data: { email: "backfill-count-none@tu-berlin.de", passwordHash: "hash", isVerified: true },
    });

    const result = await backfillTopBadges(prisma);

    expect(result.updatedCount).toBe(2);
  });
});
