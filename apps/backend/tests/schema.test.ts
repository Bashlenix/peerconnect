import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { UNIVERSITIES, BADGES, seedReferenceData } from "../prisma/seed-data.js";

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

// ─── Universities ────────────────────────────────────────────────────────────

describe("universities table", () => {
  it("contains at least 5 German university domains", async () => {
    const count = await prisma.university.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it("has a unique domain constraint", async () => {
    await expect(
      prisma.university.create({
        data: { name: "Duplicate", domain: "uni-dortmund.de" },
      })
    ).rejects.toThrow();
  });

  it("includes known German universities", async () => {
    const domains = await prisma.university
      .findMany({ select: { domain: true } })
      .then((rows) => rows.map((r) => r.domain));

    for (const { domain } of UNIVERSITIES) {
      expect(domains).toContain(domain);
    }
  });
});

// ─── Badges ──────────────────────────────────────────────────────────────────

describe("badges table", () => {
  it("contains exactly 7 badge definitions", async () => {
    const count = await prisma.badge.count();
    expect(count).toBe(BADGES.length);
  });

  it("has all required badge names", async () => {
    const names = await prisma.badge
      .findMany({ select: { name: true } })
      .then((rows) => rows.map((r) => r.name));

    for (const { name } of BADGES) {
      expect(names).toContain(name);
    }
  });
});

// ─── Users ───────────────────────────────────────────────────────────────────

describe("users table", () => {
  it("creates a user with required fields", async () => {
    const user = await prisma.user.create({
      data: { email: "test@uni-dortmund.de", passwordHash: "hash" },
    });
    expect(user.id).toBeTruthy();
    expect(user.isVerified).toBe(false);
    expect(user.requiresManualReview).toBe(false);
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("enforces unique email constraint", async () => {
    const u = await prisma.user.create({
      data: { email: "unique@tu-berlin.de", passwordHash: "hash" },
    });
    await expect(
      prisma.user.create({
        data: { email: "unique@tu-berlin.de", passwordHash: "hash2" },
      })
    ).rejects.toThrow();
    await prisma.user.delete({ where: { id: u.id } });
  });
});

// ─── Posts + search_vector ───────────────────────────────────────────────────

describe("posts table", () => {
  let authorId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: "author@lmu.de", passwordHash: "hash" },
    });
    authorId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: authorId } });
  });

  it("creates a post and auto-generates search_vector", async () => {
    const post = await prisma.post.create({
      data: {
        content: "Looking for study partners in mathematics",
        category: "Academic",
        authorId,
      },
    });

    const result = await pool.query<{ search_vector: string }>(
      "SELECT search_vector::text FROM posts WHERE id = $1",
      [post.id]
    );
    expect(result.rows[0]?.search_vector).toBeTruthy();
    expect(result.rows[0]?.search_vector).toMatch(/mathemat/);

    await prisma.post.delete({ where: { id: post.id } });
  });

  it("GIN index exists on search_vector", async () => {
    const result = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'posts' AND indexname = 'posts_search_vector_idx'"
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.indexname).toBe("posts_search_vector_idx");
  });

  it("posts deleted when author is deleted (CASCADE)", async () => {
    const user = await prisma.user.create({
      data: { email: "cascade-test@rwth-aachen.de", passwordHash: "hash" },
    });
    await prisma.post.create({
      data: { content: "Test post", category: "Social", authorId: user.id },
    });
    await prisma.user.delete({ where: { id: user.id } });
    const posts = await prisma.post.findMany({ where: { authorId: user.id } });
    expect(posts).toHaveLength(0);
  });
});

// ─── Replies + Upvotes ───────────────────────────────────────────────────────

describe("replies and upvotes", () => {
  let userId: string;
  let postId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: "reply-author@hu-berlin.de", passwordHash: "hash" },
    });
    userId = user.id;
    const post = await prisma.post.create({
      data: { content: "Any advice on housing?", category: "DailyLifeSupport", authorId: userId },
    });
    postId = post.id;
  });

  it("creates a reply with isSolution defaulting to false", async () => {
    const reply = await prisma.reply.create({
      data: { content: "Try the student union website", authorId: userId, postId },
    });
    expect(reply.isSolution).toBe(false);
    await prisma.reply.delete({ where: { id: reply.id } });
  });

  it("enforces unique upvote per user+reply", async () => {
    const reply = await prisma.reply.create({
      data: { content: "Another tip", authorId: userId, postId },
    });
    await prisma.upvote.create({ data: { userId, replyId: reply.id } });
    await expect(
      prisma.upvote.create({ data: { userId, replyId: reply.id } })
    ).rejects.toThrow();
    await prisma.upvote.deleteMany({ where: { replyId: reply.id } });
    await prisma.reply.delete({ where: { id: reply.id } });
  });
});

// ─── Subscriptions ───────────────────────────────────────────────────────────

describe("subscriptions table", () => {
  it("defaults to free status", async () => {
    const user = await prisma.user.create({
      data: { email: "sub-test@uni-cologne.de", passwordHash: "hash" },
    });
    const sub = await prisma.subscription.create({
      data: { userId: user.id },
    });
    expect(sub.status).toBe("free");
    expect(sub.endDate).toBeNull();
    await prisma.subscription.delete({ where: { id: sub.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
