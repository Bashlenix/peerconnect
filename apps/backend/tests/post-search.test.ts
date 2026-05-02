import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";
import { searchPosts } from "../src/modules/post-search.js";

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

// ─── PostSearchService.searchPosts ───────────────────────────────────────────

describe("PostSearchService.searchPosts", () => {
  it("returns posts matching a keyword in content", async () => {
    const author = await prisma.user.create({
      data: { email: "search-basic@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.post.createMany({
      data: [
        { content: "calculus homework help needed", category: "Academic", authorId: author.id },
        { content: "looking for football team", category: "Sport", authorId: author.id },
      ],
    });

    const results = await searchPosts(prisma, { q: "calculus", limit: 10, offset: 0 });

    expect(results.some((p) => p.content.includes("calculus"))).toBe(true);
    expect(results.every((p) => !p.content.includes("football"))).toBe(true);
  });

  it("matches stemmed words (e.g. 'study' matches post containing 'studying')", async () => {
    const author = await prisma.user.create({
      data: { email: "search-stem@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.post.create({
      data: { content: "I am studying for my upcoming exams", category: "Academic", authorId: author.id },
    });

    const results = await searchPosts(prisma, { q: "study", limit: 10, offset: 0 });

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("studying");
  });

  it("combines keyword search with category filter", async () => {
    const author = await prisma.user.create({
      data: { email: "search-cat@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.post.createMany({
      data: [
        { content: "exam preparation tips", category: "Academic", authorId: author.id },
        { content: "exam prep for sport events", category: "Sport", authorId: author.id },
      ],
    });

    const results = await searchPosts(prisma, { q: "exam", limit: 10, offset: 0, category: "Academic" });

    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("Academic");
    expect(results[0].content).toContain("exam preparation");
  });

  it("combines keyword search with time filter", async () => {
    const author = await prisma.user.create({
      data: { email: "search-since@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    await prisma.post.create({
      data: { content: "recent lecture notes available", category: "Academic", authorId: author.id, createdAt: recentDate },
    });
    await prisma.post.create({
      data: { content: "old lecture materials from last semester", category: "Academic", authorId: author.id, createdAt: oldDate },
    });

    const results = await searchPosts(prisma, { q: "lecture", limit: 10, offset: 0, since: "24h" });

    const contents = results.map((p) => p.content);
    expect(contents.some((c) => c.includes("recent lecture"))).toBe(true);
    expect(contents.every((c) => !c.includes("old lecture"))).toBe(true);
  });

  it("returns empty array when no posts match the query", async () => {
    const author = await prisma.user.create({
      data: { email: "search-empty@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.post.create({
      data: { content: "football practice schedule", category: "Sport", authorId: author.id },
    });

    const results = await searchPosts(prisma, { q: "quantum physics", limit: 10, offset: 0 });

    expect(results).toHaveLength(0);
  });

  it("does not error on SQL injection attempts — uses parameterised queries", async () => {
    const author = await prisma.user.create({
      data: { email: "search-injection@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.post.create({
      data: { content: "some normal post content", category: "Academic", authorId: author.id },
    });

    // websearch_to_tsquery treats the whole string as a query — no injection
    await expect(
      searchPosts(prisma, { q: "'; DROP TABLE posts; --", limit: 10, offset: 0 })
    ).resolves.not.toThrow();

    const postCount = await prisma.post.count();
    expect(postCount).toBeGreaterThan(0);
  });

  it("ranks higher-relevance posts first (ts_rank ordering)", async () => {
    const author = await prisma.user.create({
      data: { email: "search-rank@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    await prisma.post.create({
      data: {
        content: "calculus calculus calculus — multiple references to calculus homework",
        category: "Academic",
        authorId: author.id,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    });
    await prisma.post.create({
      data: {
        content: "calculus question",
        category: "Academic",
        authorId: author.id,
        createdAt: new Date("2024-01-02T00:00:00Z"),
      },
    });

    const results = await searchPosts(prisma, { q: "calculus", limit: 10, offset: 0 });

    expect(results).toHaveLength(2);
    // Post with more occurrences of "calculus" should rank higher
    expect(results[0].content).toContain("multiple references");
  });

  it("includes correct reply count in results", async () => {
    const author = await prisma.user.create({
      data: { email: "search-replies@example.com", passwordHash: "hash", isVerified: true },
      select: { id: true },
    });
    const post = await prisma.post.create({
      data: { content: "differential equations help", category: "Academic", authorId: author.id },
      select: { id: true },
    });
    await prisma.reply.createMany({
      data: [
        { content: "Reply 1", authorId: author.id, postId: post.id },
        { content: "Reply 2", authorId: author.id, postId: post.id },
      ],
    });

    const results = await searchPosts(prisma, { q: "differential", limit: 10, offset: 0 });

    expect(results).toHaveLength(1);
    expect(results[0].replyCount).toBe(2);
  });
});

// ─── GET /posts/search ────────────────────────────────────────────────────────

describe("GET /posts/search", () => {
  it("returns matching posts for authenticated user", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("search-route@tu-berlin.de");
    await prisma.post.create({
      data: { content: "linear algebra exam tips", category: "Academic", authorId: userId },
    });

    const res = await app.inject({
      method: "GET",
      url: "/posts/search?q=algebra",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { posts: Array<{ content: string }> };
    expect(body.posts).toBeInstanceOf(Array);
    expect(body.posts.some((p) => p.content.includes("algebra"))).toBe(true);
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/posts/search?q=test",
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when q is missing", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("search-noq@tu-berlin.de");

    const res = await app.inject({
      method: "GET",
      url: "/posts/search",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(400);
  });

  it("filters by category query param when combined with search", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("search-catroute@tu-berlin.de");
    await prisma.post.createMany({
      data: [
        { content: "programming project tips", category: "Academic", authorId: userId },
        { content: "programming social hackathon", category: "Social", authorId: userId },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/posts/search?q=programming&category=Academic",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { posts: Array<{ category: string }> };
    expect(body.posts.every((p) => p.category === "Academic")).toBe(true);
  });
});
