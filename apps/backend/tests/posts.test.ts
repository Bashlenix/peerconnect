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

  it("filters by category", async () => {
    const author = await prisma.user.create({
      data: { email: "fq-cat@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.post.createMany({
      data: [
        { content: "Academic post", category: "Academic", authorId: author.id },
        { content: "Social post", category: "Social", authorId: author.id },
      ],
    });

    const posts = await getFeedPosts(prisma, { limit: 10, offset: 0, category: "Academic" });

    expect(posts.every((p) => p.category === "Academic")).toBe(true);
    expect(posts.some((p) => p.content === "Academic post")).toBe(true);
    expect(posts.some((p) => p.content === "Social post")).toBe(false);
  });

  it("filters by since (time range)", async () => {
    const author = await prisma.user.create({
      data: { email: "fq-since@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const recentDate = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12h ago
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

    await prisma.post.create({
      data: { content: "Recent post", category: "Academic", authorId: author.id, createdAt: recentDate },
    });
    await prisma.post.create({
      data: { content: "Old post", category: "Academic", authorId: author.id, createdAt: oldDate },
    });

    const posts = await getFeedPosts(prisma, { limit: 10, offset: 0, since: "24h" });

    const contents = posts.map((p) => p.content);
    expect(contents).toContain("Recent post");
    expect(contents).not.toContain("Old post");
  });

  it("filters by subscribed categories", async () => {
    const user = await prisma.user.create({
      data: { email: "fq-sub@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.notificationPreference.create({ data: { userId: user.id, category: "Sport" } });
    await prisma.post.createMany({
      data: [
        { content: "A sport post", category: "Sport", authorId: user.id },
        { content: "A social post", category: "Social", authorId: user.id },
      ],
    });

    const posts = await getFeedPosts(prisma, { limit: 10, offset: 0, subscribed: true, userId: user.id });

    expect(posts.every((p) => p.category === "Sport")).toBe(true);
    expect(posts.some((p) => p.content === "A sport post")).toBe(true);
    expect(posts.some((p) => p.content === "A social post")).toBe(false);
  });

  it("returns empty array for subscribed filter when user has no preferences", async () => {
    const user = await prisma.user.create({
      data: { email: "fq-sub-empty@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.post.create({
      data: { content: "Any post", category: "Academic", authorId: user.id },
    });

    const posts = await getFeedPosts(prisma, { limit: 10, offset: 0, subscribed: true, userId: user.id });

    expect(posts).toHaveLength(0);
  });

  it("combines category and since filters", async () => {
    const author = await prisma.user.create({
      data: { email: "fq-combo@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1h ago
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

    await prisma.post.createMany({
      data: [
        { content: "Recent Academic", category: "Academic", authorId: author.id, createdAt: recentDate },
        { content: "Old Academic", category: "Academic", authorId: author.id, createdAt: oldDate },
        { content: "Recent Social", category: "Social", authorId: author.id, createdAt: recentDate },
      ],
    });

    const posts = await getFeedPosts(prisma, { limit: 10, offset: 0, category: "Academic", since: "7d" });

    const contents = posts.map((p) => p.content);
    expect(contents).toContain("Recent Academic");
    expect(contents).not.toContain("Old Academic");
    expect(contents).not.toContain("Recent Social");
  });

  it("subscribed filter respects specific category intersection", async () => {
    const user = await prisma.user.create({
      data: { email: "fq-sub-cat@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.notificationPreference.create({ data: { userId: user.id, category: "Academic" } });
    await prisma.post.createMany({
      data: [
        { content: "Academic post", category: "Academic", authorId: user.id },
        { content: "Sport post", category: "Sport", authorId: user.id },
      ],
    });

    // category=Sport is NOT in subscribed list → empty
    const noMatch = await getFeedPosts(prisma, { limit: 10, offset: 0, category: "Sport", subscribed: true, userId: user.id });
    expect(noMatch).toHaveLength(0);

    // category=Academic IS in subscribed list → returns matching post
    const match = await getFeedPosts(prisma, { limit: 10, offset: 0, category: "Academic", subscribed: true, userId: user.id });
    expect(match.some((p) => p.content === "Academic post")).toBe(true);
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

  it("filters by category via query param", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("get-filter-cat@tu-berlin.de");
    await prisma.post.createMany({
      data: [
        { content: "Academic one", category: "Academic", authorId: userId },
        { content: "Social one", category: "Social", authorId: userId },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/posts?category=Academic",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const posts = res.json().posts as Array<{ category: string }>;
    expect(posts.every((p) => p.category === "Academic")).toBe(true);
    expect(posts.some((p: { content?: string }) => (p as { content: string }).content === "Academic one")).toBe(true);
  });

  it("filters by since via query param", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("get-filter-since@tu-berlin.de");
    const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    await prisma.post.create({
      data: { content: "Recent", category: "Academic", authorId: userId, createdAt: recentDate },
    });
    await prisma.post.create({
      data: { content: "Old", category: "Academic", authorId: userId, createdAt: oldDate },
    });

    const res = await app.inject({
      method: "GET",
      url: "/posts?since=24h",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const contents = (res.json().posts as Array<{ content: string }>).map((p) => p.content);
    expect(contents).toContain("Recent");
    expect(contents).not.toContain("Old");
  });

  it("returns 400 for invalid category query param", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("get-filter-badcat@tu-berlin.de");

    const res = await app.inject({
      method: "GET",
      url: "/posts?category=InvalidCategory",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for invalid since query param", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("get-filter-badsince@tu-berlin.de");

    const res = await app.inject({
      method: "GET",
      url: "/posts?since=2w",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── PATCH /posts/:id/solution ────────────────────────────────────────────────

describe("PATCH /posts/:id/solution", () => {
  it("marks a reply as solution and returns 200 with replyId", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("sol-set@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Q", category: "Academic", authorId: userId },
      select: { id: true },
    });
    const r = await prisma.reply.create({
      data: { content: "A", authorId: userId, postId: post.id },
      select: { id: true },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/posts/${post.id}/solution`,
      headers: { cookie: cookieHeader },
      payload: { replyId: r.id },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().replyId).toBe(r.id);

    const updated = await prisma.reply.findUnique({ where: { id: r.id }, select: { isSolution: true } });
    expect(updated?.isSolution).toBe(true);
  });

  it("replaces a previous solution with the new one", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("sol-replace@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Q", category: "Academic", authorId: userId },
      select: { id: true },
    });
    const r1 = await prisma.reply.create({
      data: { content: "Old answer", authorId: userId, postId: post.id, isSolution: true },
      select: { id: true },
    });
    const r2 = await prisma.reply.create({
      data: { content: "Better answer", authorId: userId, postId: post.id },
      select: { id: true },
    });

    await app.inject({
      method: "PATCH",
      url: `/posts/${post.id}/solution`,
      headers: { cookie: cookieHeader },
      payload: { replyId: r2.id },
    });

    const old = await prisma.reply.findUnique({ where: { id: r1.id }, select: { isSolution: true } });
    const newer = await prisma.reply.findUnique({ where: { id: r2.id }, select: { isSolution: true } });
    expect(old?.isSolution).toBe(false);
    expect(newer?.isSolution).toBe(true);
  });

  it("returns 403 if requester is not the post author", async () => {
    const { userId } = await registerVerifyAndLogin("sol-owner@tu-berlin.de");
    const { cookieHeader: otherCookie } = await registerVerifyAndLogin("sol-other@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Q", category: "Academic", authorId: userId },
      select: { id: true },
    });
    const r = await prisma.reply.create({
      data: { content: "A", authorId: userId, postId: post.id },
      select: { id: true },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/posts/${post.id}/solution`,
      headers: { cookie: otherCookie },
      payload: { replyId: r.id },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent post", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("sol-404post@tu-berlin.de");

    const res = await app.inject({
      method: "PATCH",
      url: "/posts/nonexistent/solution",
      headers: { cookie: cookieHeader },
      payload: { replyId: "some-reply" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when reply does not belong to the post", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("sol-wrongpost@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Q", category: "Academic", authorId: userId },
      select: { id: true },
    });
    const otherPost = await prisma.post.create({
      data: { content: "Other", category: "Social", authorId: userId },
      select: { id: true },
    });
    const r = await prisma.reply.create({
      data: { content: "A", authorId: userId, postId: otherPost.id },
      select: { id: true },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/posts/${post.id}/solution`,
      headers: { cookie: cookieHeader },
      payload: { replyId: r.id },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/posts/some-id/solution",
      payload: { replyId: "some-reply" },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── DELETE /posts/:id/solution ───────────────────────────────────────────────

describe("DELETE /posts/:id/solution", () => {
  it("unmarks the current solution and returns 204", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("unsol@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Q", category: "Academic", authorId: userId },
      select: { id: true },
    });
    const r = await prisma.reply.create({
      data: { content: "A", authorId: userId, postId: post.id, isSolution: true },
      select: { id: true },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/posts/${post.id}/solution`,
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(204);
    const updated = await prisma.reply.findUnique({ where: { id: r.id }, select: { isSolution: true } });
    expect(updated?.isSolution).toBe(false);
  });

  it("returns 403 if requester is not the post author", async () => {
    const { userId } = await registerVerifyAndLogin("unsol-owner@tu-berlin.de");
    const { cookieHeader: otherCookie } = await registerVerifyAndLogin("unsol-other@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Q", category: "Academic", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/posts/${post.id}/solution`,
      headers: { cookie: otherCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for non-existent post", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("unsol-404@tu-berlin.de");

    const res = await app.inject({
      method: "DELETE",
      url: "/posts/nonexistent/solution",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({ method: "DELETE", url: "/posts/some-id/solution" });
    expect(res.statusCode).toBe(401);
  });
});

// ─── PATCH /posts/:id ─────────────────────────────────────────────────────────

describe("PATCH /posts/:id", () => {
  it("updates content and sets editedAt, returns 200 with updated post", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("patch-post@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Original content", category: "Academic", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/posts/${post.id}`,
      headers: { cookie: cookieHeader },
      payload: { content: "Updated content" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.content).toBe("Updated content");
    expect(body.editedAt).not.toBeNull();
    expect(body.id).toBe(post.id);
  });

  it("returns 403 if requester is not the post author", async () => {
    const { userId } = await registerVerifyAndLogin("patch-owner@tu-berlin.de");
    const { cookieHeader: otherCookie } = await registerVerifyAndLogin("patch-other@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Content", category: "Social", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/posts/${post.id}`,
      headers: { cookie: otherCookie },
      payload: { content: "Attempt to edit" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for a non-existent post", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("patch-404@tu-berlin.de");

    const res = await app.inject({
      method: "PATCH",
      url: "/posts/nonexistent-id",
      headers: { cookie: cookieHeader },
      payload: { content: "New content" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for empty content", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("patch-empty@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Content", category: "Academic", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/posts/${post.id}`,
      headers: { cookie: cookieHeader },
      payload: { content: "" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/posts/some-id",
      payload: { content: "Content" },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ─── DELETE /posts/:id ────────────────────────────────────────────────────────

describe("DELETE /posts/:id", () => {
  it("deletes a post with no replies and returns 204", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("del-post@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "To be deleted", category: "Academic", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/posts/${post.id}`,
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(204);
    const deleted = await prisma.post.findUnique({ where: { id: post.id } });
    expect(deleted).toBeNull();
  });

  it("returns 409 when the post has replies", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("del-with-replies@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Post with replies", category: "Academic", authorId: userId },
      select: { id: true },
    });
    await prisma.reply.create({
      data: { content: "A reply", authorId: userId, postId: post.id },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/posts/${post.id}`,
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(409);
    const still = await prisma.post.findUnique({ where: { id: post.id } });
    expect(still).not.toBeNull();
  });

  it("returns 403 if requester is not the post author", async () => {
    const { userId } = await registerVerifyAndLogin("del-owner@tu-berlin.de");
    const { cookieHeader: otherCookie } = await registerVerifyAndLogin("del-other@tu-berlin.de");
    const post = await prisma.post.create({
      data: { content: "Not mine", category: "Social", authorId: userId },
      select: { id: true },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/posts/${post.id}`,
      headers: { cookie: otherCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for a non-existent post", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("del-404@tu-berlin.de");

    const res = await app.inject({
      method: "DELETE",
      url: "/posts/nonexistent-id",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({ method: "DELETE", url: "/posts/some-id" });

    expect(res.statusCode).toBe(401);
  });
});
