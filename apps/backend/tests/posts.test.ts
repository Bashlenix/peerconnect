import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";
import { getFeedPosts } from "../src/modules/feed-query.js";

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

// ─── FeedQuery.getFeedPosts ───────────────────────────────────────────────────

describe("FeedQuery.getFeedPosts", () => {
  it("returns posts in reverse-chronological order", async () => {
    const author = await prisma.user.create({
      data: { email: "fq-order@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    await prisma.post.create({
      data: {
        content: "Oldest post",
        category: "Academic",
        authorId: author.id,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    });
    await prisma.post.create({
      data: {
        content: "Newest post",
        category: "Social",
        authorId: author.id,
        createdAt: new Date("2024-01-03T00:00:00Z"),
      },
    });
    await prisma.post.create({
      data: {
        content: "Middle post",
        category: "Sport",
        authorId: author.id,
        createdAt: new Date("2024-01-02T00:00:00Z"),
      },
    });

    const posts = await getFeedPosts(prisma, { limit: 10, offset: 0 });

    expect(posts[0].content).toBe("Newest post");
    expect(posts[1].content).toBe("Middle post");
    expect(posts[2].content).toBe("Oldest post");
  });

  it("respects pagination limit", async () => {
    const author = await prisma.user.create({
      data: { email: "fq-limit@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    await prisma.post.createMany({
      data: [
        { content: "Post A", category: "Academic", authorId: author.id },
        { content: "Post B", category: "Social", authorId: author.id },
        { content: "Post C", category: "Sport", authorId: author.id },
      ],
    });

    const posts = await getFeedPosts(prisma, { limit: 2, offset: 0 });

    expect(posts).toHaveLength(2);
  });

  it("respects pagination offset", async () => {
    const author = await prisma.user.create({
      data: { email: "fq-offset@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });

    await prisma.post.create({
      data: {
        content: "First",
        category: "Academic",
        authorId: author.id,
        createdAt: new Date("2024-01-03T00:00:00Z"),
      },
    });
    await prisma.post.create({
      data: {
        content: "Second",
        category: "Social",
        authorId: author.id,
        createdAt: new Date("2024-01-02T00:00:00Z"),
      },
    });
    await prisma.post.create({
      data: {
        content: "Third",
        category: "Sport",
        authorId: author.id,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    });

    const allPosts = await getFeedPosts(prisma, { limit: 10, offset: 0 });
    const page2 = await getFeedPosts(prisma, { limit: 10, offset: 2 });

    expect(page2).toHaveLength(1);
    expect(page2[0].id).toBe(allPosts[2].id);
  });

  it("includes reply count", async () => {
    const author = await prisma.user.create({
      data: { email: "fq-replies@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "Post with replies", category: "Academic", authorId: author.id },
      select: { id: true },
    });
    await prisma.reply.createMany({
      data: [
        { content: "Reply 1", authorId: author.id, postId: post.id },
        { content: "Reply 2", authorId: author.id, postId: post.id },
      ],
    });

    const posts = await getFeedPosts(prisma, { limit: 10, offset: 0 });

    expect(posts[0].replyCount).toBe(2);
  });
});

// ─── POST /posts ──────────────────────────────────────────────────────────────

describe("POST /posts", () => {
  it("creates a post for an authenticated user and returns 201", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("post-create@tu-berlin.de");

    const res = await app.inject({
      method: "POST",
      url: "/posts",
      headers: { cookie: cookieHeader },
      payload: { content: "Need help with calculus homework", category: "Academic" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      content: "Need help with calculus homework",
      category: "Academic",
      isUrgent: false,
      replyCount: 0,
      author: { id: expect.any(String) },
    });
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
    expect(body.editedAt).toBeNull();
  });

  it("creates an urgent post when isUrgent is true", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("post-urgent@tu-berlin.de");

    const res = await app.inject({
      method: "POST",
      url: "/posts",
      headers: { cookie: cookieHeader },
      payload: { content: "Urgent: exam tomorrow!", category: "Academic", isUrgent: true },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().isUrgent).toBe(true);
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/posts",
      payload: { content: "Hello", category: "Social" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for invalid category", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("post-badcat@tu-berlin.de");

    const res = await app.inject({
      method: "POST",
      url: "/posts",
      headers: { cookie: cookieHeader },
      payload: { content: "Hello", category: "InvalidCategory" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for empty content", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("post-empty@tu-berlin.de");

    const res = await app.inject({
      method: "POST",
      url: "/posts",
      headers: { cookie: cookieHeader },
      payload: { content: "", category: "Academic" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("post-missing@tu-berlin.de");

    const res = await app.inject({
      method: "POST",
      url: "/posts",
      headers: { cookie: cookieHeader },
      payload: { category: "Academic" },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /posts ───────────────────────────────────────────────────────────────

describe("GET /posts", () => {
  it("returns posts array for authenticated user", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("get-posts@tu-berlin.de");

    await app.inject({
      method: "POST",
      url: "/posts",
      headers: { cookie: cookieHeader },
      payload: { content: "A question about maths", category: "Academic" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/posts",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.posts).toBeInstanceOf(Array);
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0]).toMatchObject({
      content: "A question about maths",
      category: "Academic",
      replyCount: 0,
    });
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({ method: "GET", url: "/posts" });

    expect(res.statusCode).toBe(401);
  });

  it("returns posts in reverse-chronological order", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("get-order@tu-berlin.de");

    await prisma.post.create({
      data: {
        content: "Old post",
        category: "Academic",
        authorId: userId,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    });
    await prisma.post.create({
      data: {
        content: "New post",
        category: "Social",
        authorId: userId,
        createdAt: new Date("2024-01-03T00:00:00Z"),
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/posts",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const posts = res.json().posts;
    expect(posts[0].content).toBe("New post");
    expect(posts[1].content).toBe("Old post");
  });

  it("respects limit and offset query params", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("get-paginate@tu-berlin.de");

    for (let i = 1; i <= 5; i++) {
      await prisma.post.create({
        data: {
          content: `Post ${i}`,
          category: "Academic",
          authorId: userId,
          createdAt: new Date(`2024-01-0${i}T00:00:00Z`),
        },
      });
    }

    const page1 = await app.inject({
      method: "GET",
      url: "/posts?limit=2&offset=0",
      headers: { cookie: cookieHeader },
    });
    const page2 = await app.inject({
      method: "GET",
      url: "/posts?limit=2&offset=2",
      headers: { cookie: cookieHeader },
    });

    expect(page1.json().posts).toHaveLength(2);
    expect(page2.json().posts).toHaveLength(2);
    expect(page1.json().posts[0].id).not.toBe(page2.json().posts[0].id);
  });
});
