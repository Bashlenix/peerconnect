import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";
import { getReplies } from "../src/modules/reply-query.js";

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

// ─── ReplyQuery.getReplies ────────────────────────────────────────────────────

describe("ReplyQuery.getReplies", () => {
  it("returns replies sorted: solution first, then by upvote count desc, then oldest first", async () => {
    const author = await prisma.user.create({
      data: { email: "rq-sort@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "Post", category: "Academic", authorId: author.id },
      select: { id: true },
    });

    const r1 = await prisma.reply.create({
      data: { content: "Oldest, 0 upvotes", authorId: author.id, postId: post.id, createdAt: new Date("2024-01-01T00:00:00Z") },
      select: { id: true },
    });
    const r2 = await prisma.reply.create({
      data: { content: "Middle, 2 upvotes", authorId: author.id, postId: post.id, createdAt: new Date("2024-01-02T00:00:00Z") },
      select: { id: true },
    });
    const r3 = await prisma.reply.create({
      data: { content: "Newest, solution", authorId: author.id, postId: post.id, isSolution: true, createdAt: new Date("2024-01-03T00:00:00Z") },
      select: { id: true },
    });
    const r4 = await prisma.reply.create({
      data: { content: "Old, 1 upvote", authorId: author.id, postId: post.id, createdAt: new Date("2024-01-01T06:00:00Z") },
      select: { id: true },
    });

    const voter1 = await prisma.user.create({
      data: { email: "voter1@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const voter2 = await prisma.user.create({
      data: { email: "voter2@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    await prisma.upvote.createMany({
      data: [
        { userId: voter1.id, replyId: r2.id },
        { userId: voter2.id, replyId: r2.id },
        { userId: voter1.id, replyId: r4.id },
      ],
    });

    const replies = await getReplies(prisma, post.id);

    // solution first
    expect(replies[0].id).toBe(r3.id);
    expect(replies[0].isSolution).toBe(true);
    // then 2 upvotes
    expect(replies[1].id).toBe(r2.id);
    expect(replies[1].upvoteCount).toBe(2);
    // then 1 upvote
    expect(replies[2].id).toBe(r4.id);
    expect(replies[2].upvoteCount).toBe(1);
    // then 0 upvotes, oldest
    expect(replies[3].id).toBe(r1.id);
    expect(replies[3].upvoteCount).toBe(0);
  });

  it("returns an empty array when the post has no replies", async () => {
    const author = await prisma.user.create({
      data: { email: "rq-empty@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "No replies here", category: "Social", authorId: author.id },
      select: { id: true },
    });

    const replies = await getReplies(prisma, post.id);
    expect(replies).toHaveLength(0);
  });

  it("returns correct upvoteCount for each reply", async () => {
    const author = await prisma.user.create({
      data: { email: "rq-upvote@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "Post", category: "Academic", authorId: author.id },
      select: { id: true },
    });
    const r = await prisma.reply.create({
      data: { content: "Reply", authorId: author.id, postId: post.id },
      select: { id: true },
    });
    const voter = await prisma.user.create({
      data: { email: "rq-voter@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.upvote.create({ data: { userId: voter.id, replyId: r.id } });

    const replies = await getReplies(prisma, post.id);
    expect(replies[0].upvoteCount).toBe(1);
  });
});

// ─── GET /posts/:id/replies ───────────────────────────────────────────────────

describe("GET /posts/:id/replies", () => {
  it("returns empty replies array for a post with no replies", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("get-replies-empty@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "GET",
      url: `/posts/${post.id}/replies`,
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().replies).toEqual([]);
  });

  it("returns sorted replies with correct shape", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("get-replies-shape@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: userId },
      select: { id: true },
    });
    const reply = await prisma.reply.create({
      data: { content: "An answer", authorId: userId, postId: post.id },
      select: { id: true },
    });

    const res = await app.inject({
      method: "GET",
      url: `/posts/${post.id}/replies`,
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const { replies } = res.json();
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({
      id: reply.id,
      content: "An answer",
      isSolution: false,
      upvoteCount: 0,
      author: { id: userId },
    });
    expect(replies[0].createdAt).toBeDefined();
    expect(replies[0].editedAt).toBeNull();
  });

  it("returns 404 for a non-existent post", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("get-replies-404@tu-berlin.de");

    const res = await app.inject({
      method: "GET",
      url: "/posts/nonexistent-id/replies",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBe("Post not found");
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/posts/some-id/replies",
    });

    expect(res.statusCode).toBe(401);
  });
});

// ─── POST /posts/:id/replies ──────────────────────────────────────────────────

describe("POST /posts/:id/replies", () => {
  it("creates a reply and returns 201 with correct shape", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("create-reply@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "POST",
      url: `/posts/${post.id}/replies`,
      headers: { cookie: cookieHeader },
      payload: { content: "Here is my answer" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      content: "Here is my answer",
      isSolution: false,
      upvoteCount: 0,
      author: { id: userId },
    });
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
    expect(body.editedAt).toBeNull();
  });

  it("persists the reply in the database", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("create-reply-persist@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: userId },
      select: { id: true },
    });

    await app.inject({
      method: "POST",
      url: `/posts/${post.id}/replies`,
      headers: { cookie: cookieHeader },
      payload: { content: "Persisted reply" },
    });

    const count = await prisma.reply.count({ where: { postId: post.id } });
    expect(count).toBe(1);
  });

  it("returns 404 for a non-existent post", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("create-reply-404@tu-berlin.de");

    const res = await app.inject({
      method: "POST",
      url: "/posts/nonexistent-id/replies",
      headers: { cookie: cookieHeader },
      payload: { content: "Reply to nowhere" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBe("Post not found");
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/posts/some-id/replies",
      payload: { content: "Unauthenticated" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for empty content", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("create-reply-empty@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "POST",
      url: `/posts/${post.id}/replies`,
      headers: { cookie: cookieHeader },
      payload: { content: "" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("create-reply-missing@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Question", category: "Academic", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "POST",
      url: `/posts/${post.id}/replies`,
      headers: { cookie: cookieHeader },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
