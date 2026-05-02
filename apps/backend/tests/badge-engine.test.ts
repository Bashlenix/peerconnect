import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";
import { checkAndAwardBadges } from "../src/modules/badge-engine.js";

vi.mock("../src/modules/email-verification-service.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/modules/email-verification-service.js")>();
  return {
    ...original,
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  };
});

const TEST_DB_URL =
  process.env["DATABASE_URL"] ?? "postgresql://bashi@localhost:5432/peerconnect_test";

let pool: Pool;
let prisma: PrismaClient;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DB_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
  await seedReferenceData(prisma);

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await pool.query(
    `TRUNCATE TABLE user_badges, notification_preferences, notifications,
                   upvotes, replies, posts, subscriptions, users,
                   badges, universities CASCADE`
  );
  await app.close();
  await prisma.$disconnect();
  await pool.end();
});

afterEach(async () => {
  await pool.query("DELETE FROM users");
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerVerifyAndLogin(email: string, password = "securePass1") {
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password },
  });
  const user = await prisma.user.findUnique({ where: { email } });
  await prisma.user.update({
    where: { id: user!.id },
    data: { isVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
  });
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  const cookies = res.headers["set-cookie"] as string | string[];
  return {
    cookieHeader: Array.isArray(cookies) ? cookies.join("; ") : cookies,
    userId: user!.id,
  };
}

async function createUserWithReplies(
  email: string,
  replyCount: number,
  category: "Academic" | "Social" | "Sport" | "DailyLifeSupport" = "Academic"
) {
  const author = await prisma.user.create({
    data: { email, passwordHash: "hash", isVerified: true },
    select: { id: true },
  });
  const postAuthor = await prisma.user.create({
    data: { email: `post-${email}`, passwordHash: "hash", isVerified: true },
    select: { id: true },
  });
  const post = await prisma.post.create({
    data: { content: "Post", category, authorId: postAuthor.id },
    select: { id: true },
  });
  await prisma.reply.createMany({
    data: Array.from({ length: replyCount }, (_, i) => ({
      content: `Reply ${i}`,
      authorId: author.id,
      postId: post.id,
    })),
  });
  return { userId: author.id };
}

// ─── BadgeEngine unit tests ───────────────────────────────────────────────────

describe("BadgeEngine.checkAndAwardBadges — REPLY_CREATED", () => {
  it("awards First Reply badge when user has 1 reply", async () => {
    const { userId } = await createUserWithReplies("be-first-reply@tu-berlin.de", 1);

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, userId, "REPLY_CREATED")
    );

    expect(awarded.map((b) => b.name)).toContain("First Reply");
  });

  it("awards Getting Started badge when user has exactly 3 replies", async () => {
    const { userId } = await createUserWithReplies("be-getting-started@tu-berlin.de", 3);

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, userId, "REPLY_CREATED")
    );

    expect(awarded.map((b) => b.name)).toContain("Getting Started");
  });

  it("awards Active Helper badge when user has 10 replies", async () => {
    const { userId } = await createUserWithReplies("be-active-helper@tu-berlin.de", 10);

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, userId, "REPLY_CREATED")
    );

    const names = awarded.map((b) => b.name);
    expect(names).toContain("Active Helper");
  });

  it("awards multiple reply badges at once when crossing multiple thresholds", async () => {
    const { userId } = await createUserWithReplies("be-multi-reply@tu-berlin.de", 10);

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, userId, "REPLY_CREATED")
    );

    const names = awarded.map((b) => b.name);
    expect(names).toContain("First Reply");
    expect(names).toContain("Getting Started");
    expect(names).toContain("Active Helper");
  });

  it("awards Community Builder badge when user has 10 Social/Sport replies", async () => {
    const author = await prisma.user.create({
      data: { email: "be-community@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const postAuthor = await prisma.user.create({
      data: { email: "be-community-post@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const socialPost = await prisma.post.create({
      data: { content: "Social post", category: "Social", authorId: postAuthor.id },
      select: { id: true },
    });
    const sportPost = await prisma.post.create({
      data: { content: "Sport post", category: "Sport", authorId: postAuthor.id },
      select: { id: true },
    });
    await prisma.reply.createMany({
      data: [
        ...Array.from({ length: 6 }, (_, i) => ({
          content: `Social reply ${i}`,
          authorId: author.id,
          postId: socialPost.id,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          content: `Sport reply ${i}`,
          authorId: author.id,
          postId: sportPost.id,
        })),
      ],
    });

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, author.id, "REPLY_CREATED")
    );

    expect(awarded.map((b) => b.name)).toContain("Community Builder");
  });

  it("does not award Community Builder for Academic replies only", async () => {
    const { userId } = await createUserWithReplies(
      "be-no-community@tu-berlin.de",
      10,
      "Academic"
    );

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, userId, "REPLY_CREATED")
    );

    expect(awarded.map((b) => b.name)).not.toContain("Community Builder");
  });

  it("returns empty array when reply count is 0", async () => {
    const user = await prisma.user.create({
      data: { email: "be-zero-replies@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, user.id, "REPLY_CREATED")
    );

    expect(awarded).toHaveLength(0);
  });
});

describe("BadgeEngine.checkAndAwardBadges — UPVOTE_RECEIVED", () => {
  it("awards Helpful Contributor badge when user has received 5 upvotes", async () => {
    const replyAuthor = await prisma.user.create({
      data: { email: "be-helpful@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const postAuthor = await prisma.user.create({
      data: { email: "be-helpful-post@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "Post", category: "Academic", authorId: postAuthor.id },
      select: { id: true },
    });
    const reply = await prisma.reply.create({
      data: { content: "Reply", authorId: replyAuthor.id, postId: post.id },
      select: { id: true },
    });
    const voters = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.user.create({
          data: { email: `be-helpful-voter${i}@tu-berlin.de`, passwordHash: "hash", isVerified: true },
          select: { id: true },
        })
      )
    );
    await prisma.upvote.createMany({
      data: voters.map((v) => ({ userId: v.id, replyId: reply.id })),
    });

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, replyAuthor.id, "UPVOTE_RECEIVED")
    );

    expect(awarded.map((b) => b.name)).toContain("Helpful Contributor");
  });

  it("awards Trusted Helper badge when user has received 15 upvotes", async () => {
    const replyAuthor = await prisma.user.create({
      data: { email: "be-trusted@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const postAuthor = await prisma.user.create({
      data: { email: "be-trusted-post@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "Post", category: "Academic", authorId: postAuthor.id },
      select: { id: true },
    });
    const reply = await prisma.reply.create({
      data: { content: "Reply", authorId: replyAuthor.id, postId: post.id },
      select: { id: true },
    });
    const voters = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        prisma.user.create({
          data: { email: `be-trusted-voter${i}@tu-berlin.de`, passwordHash: "hash", isVerified: true },
          select: { id: true },
        })
      )
    );
    await prisma.upvote.createMany({
      data: voters.map((v) => ({ userId: v.id, replyId: reply.id })),
    });

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, replyAuthor.id, "UPVOTE_RECEIVED")
    );

    const names = awarded.map((b) => b.name);
    expect(names).toContain("Helpful Contributor");
    expect(names).toContain("Trusted Helper");
  });

  it("returns empty array when upvote count is below threshold", async () => {
    const user = await prisma.user.create({
      data: { email: "be-few-upvotes@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, user.id, "UPVOTE_RECEIVED")
    );

    expect(awarded).toHaveLength(0);
  });
});

describe("BadgeEngine.checkAndAwardBadges — SOLUTION_MARKED", () => {
  it("awards Solution Provider badge when user has 5 accepted solutions", async () => {
    const replyAuthor = await prisma.user.create({
      data: { email: "be-solution-prov@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const postAuthor = await prisma.user.create({
      data: { email: "be-solution-post@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const posts = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.post.create({
          data: { content: `Post ${i}`, category: "Academic", authorId: postAuthor.id },
          select: { id: true },
        })
      )
    );
    await prisma.reply.createMany({
      data: posts.map((p) => ({
        content: "Solution",
        authorId: replyAuthor.id,
        postId: p.id,
        isSolution: true,
      })),
    });

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, replyAuthor.id, "SOLUTION_MARKED")
    );

    expect(awarded.map((b) => b.name)).toContain("Solution Provider");
  });

  it("returns empty array when solution count is below threshold", async () => {
    const user = await prisma.user.create({
      data: { email: "be-few-solutions@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, user.id, "SOLUTION_MARKED")
    );

    expect(awarded).toHaveLength(0);
  });
});

describe("BadgeEngine.checkAndAwardBadges — idempotency", () => {
  it("does not re-award a badge the user already owns", async () => {
    const { userId } = await createUserWithReplies("be-idempotent@tu-berlin.de", 1);

    // Award once
    await prisma.$transaction((tx) => checkAndAwardBadges(tx, userId, "REPLY_CREATED"));

    // Award again — should return empty
    const second = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, userId, "REPLY_CREATED")
    );

    expect(second).toHaveLength(0);

    // Verify only one badge row exists
    const count = await prisma.userBadge.count({ where: { userId } });
    expect(count).toBe(1);
  });
});

describe("BadgeEngine.checkAndAwardBadges — event type filtering", () => {
  it("UPVOTE_RECEIVED event does not award reply-based badges", async () => {
    const { userId } = await createUserWithReplies("be-event-upvote@tu-berlin.de", 10);

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, userId, "UPVOTE_RECEIVED")
    );

    const replyBadges = ["First Reply", "Getting Started", "Active Helper", "Community Builder"];
    for (const name of replyBadges) {
      expect(awarded.map((b) => b.name)).not.toContain(name);
    }
  });

  it("SOLUTION_MARKED event does not award reply or upvote badges", async () => {
    const replyAuthor = await prisma.user.create({
      data: { email: "be-event-solution@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const postAuthor = await prisma.user.create({
      data: { email: "be-event-sol-post@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    // Create 10 solutions (exceeds both reply and solution thresholds)
    const posts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        prisma.post.create({
          data: { content: `Post ${i}`, category: "Academic", authorId: postAuthor.id },
          select: { id: true },
        })
      )
    );
    await prisma.reply.createMany({
      data: posts.map((p) => ({
        content: "Solution",
        authorId: replyAuthor.id,
        postId: p.id,
        isSolution: true,
      })),
    });

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, replyAuthor.id, "SOLUTION_MARKED")
    );

    const replyBadges = [
      "First Reply",
      "Getting Started",
      "Active Helper",
      "Community Builder",
      "Helpful Contributor",
      "Trusted Helper",
    ];
    for (const name of replyBadges) {
      expect(awarded.map((b) => b.name)).not.toContain(name);
    }
  });

  it("REPLY_CREATED event does not award upvote or solution badges", async () => {
    const { userId } = await createUserWithReplies("be-event-reply@tu-berlin.de", 1);

    const awarded = await prisma.$transaction((tx) =>
      checkAndAwardBadges(tx, userId, "REPLY_CREATED")
    );

    const otherBadges = ["Helpful Contributor", "Trusted Helper", "Solution Provider"];
    for (const name of otherBadges) {
      expect(awarded.map((b) => b.name)).not.toContain(name);
    }
  });
});

// ─── Integration tests — badge creation via routes ────────────────────────────

describe("Badge integration — POST /posts/:id/replies", () => {
  it("creates First Reply badge when replying for the first time", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("badge-int-first@tu-berlin.de");
    const postAuthor = await prisma.user.create({
      data: { email: "badge-int-first-post@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: postAuthor.id },
      select: { id: true },
    });

    await app.inject({
      method: "POST",
      url: `/posts/${post.id}/replies`,
      headers: { cookie: cookieHeader },
      payload: { content: "First reply" },
    });

    const badge = await prisma.badge.findUnique({ where: { name: "First Reply" } });
    const userBadge = await prisma.userBadge.findFirst({
      where: { userId, badgeId: badge!.id },
    });
    expect(userBadge).not.toBeNull();
  });

  it("creates Active Helper badge when posting the 10th reply", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("badge-int-active@tu-berlin.de");
    const postAuthor = await prisma.user.create({
      data: { email: "badge-int-active-post@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: postAuthor.id },
      select: { id: true },
    });

    // Create 9 replies directly in DB
    await prisma.reply.createMany({
      data: Array.from({ length: 9 }, (_, i) => ({
        content: `Reply ${i}`,
        authorId: userId,
        postId: post.id,
      })),
    });

    // 10th reply via HTTP
    await app.inject({
      method: "POST",
      url: `/posts/${post.id}/replies`,
      headers: { cookie: cookieHeader },
      payload: { content: "10th reply" },
    });

    const badge = await prisma.badge.findUnique({ where: { name: "Active Helper" } });
    const userBadge = await prisma.userBadge.findFirst({
      where: { userId, badgeId: badge!.id },
    });
    expect(userBadge).not.toBeNull();
  });
});

describe("Badge integration — POST /replies/:id/upvote", () => {
  it("creates Helpful Contributor badge when the 5th upvote is received", async () => {
    const { cookieHeader: voterCookie } = await registerVerifyAndLogin(
      "badge-int-voter@tu-berlin.de"
    );
    const replyAuthor = await prisma.user.create({
      data: { email: "badge-int-upvote-auth@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: replyAuthor.id },
      select: { id: true },
    });
    const targetReply = await prisma.reply.create({
      data: { content: "Reply", authorId: replyAuthor.id, postId: post.id },
      select: { id: true },
    });

    // Create 4 existing upvotes from other voters
    const voters = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        prisma.user.create({
          data: {
            email: `badge-int-upvote-v${i}@tu-berlin.de`,
            passwordHash: "hash",
            isVerified: true,
          },
          select: { id: true },
        })
      )
    );
    await prisma.upvote.createMany({
      data: voters.map((v) => ({ userId: v.id, replyId: targetReply.id })),
    });

    // 5th upvote via HTTP
    await app.inject({
      method: "POST",
      url: `/replies/${targetReply.id}/upvote`,
      headers: { cookie: voterCookie },
    });

    const badge = await prisma.badge.findUnique({ where: { name: "Helpful Contributor" } });
    const userBadge = await prisma.userBadge.findFirst({
      where: { userId: replyAuthor.id, badgeId: badge!.id },
    });
    expect(userBadge).not.toBeNull();
  });
});

describe("Badge integration — PATCH /posts/:id/solution", () => {
  it("creates Solution Provider badge when the 5th reply is marked as solution", async () => {
    const { cookieHeader: postAuthorCookie, userId: postAuthorId } =
      await registerVerifyAndLogin("badge-int-sol-post@tu-berlin.de");
    const replyAuthor = await prisma.user.create({
      data: { email: "badge-int-sol-reply@tu-berlin.de", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    // Create 4 prior posts (with replies already marked as solutions in DB)
    const priorPosts = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        prisma.post.create({
          data: { content: `Prior post ${i}`, category: "Academic", authorId: postAuthorId },
          select: { id: true },
        })
      )
    );
    await prisma.reply.createMany({
      data: priorPosts.map((p) => ({
        content: "Prior solution",
        authorId: replyAuthor.id,
        postId: p.id,
        isSolution: true,
      })),
    });

    // 5th post + reply
    const post = await prisma.post.create({
      data: { content: "5th post", category: "Academic", authorId: postAuthorId },
      select: { id: true },
    });
    const reply = await prisma.reply.create({
      data: { content: "5th solution reply", authorId: replyAuthor.id, postId: post.id },
      select: { id: true },
    });

    await app.inject({
      method: "PATCH",
      url: `/posts/${post.id}/solution`,
      headers: { cookie: postAuthorCookie },
      payload: { replyId: reply.id },
    });

    const badge = await prisma.badge.findUnique({ where: { name: "Solution Provider" } });
    const userBadge = await prisma.userBadge.findFirst({
      where: { userId: replyAuthor.id, badgeId: badge!.id },
    });
    expect(userBadge).not.toBeNull();
  });
});
