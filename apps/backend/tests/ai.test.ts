import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";
import { resetRateLimit } from "../src/modules/ai-usage.js";
import { generateAiAnswer } from "../src/modules/ai-answer.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock generateAiAnswer so tests never make real OpenAI calls.
// The mock is context-aware: if retrieval returned no posts it signals confidence
// "none", otherwise it returns a deterministic "high"-confidence answer using the
// actual retrieved posts as sources — this also exercises the retrieval path.
vi.mock("../src/modules/ai-answer.js", () => ({
  generateAiAnswer: vi.fn(async (_query: string, posts: { id: string; content: string; category: string; author: { firstName: string | null; lastName: string | null } }[]) => {
    if (posts.length === 0) {
      return { answer: null, sources: [], confidence: "none" };
    }
    return {
      answer: "Mocked answer based on retrieved posts.",
      sources: posts.map((p) => ({
        id: p.id,
        content: p.content,
        category: p.category,
        author: p.author,
      })),
      confidence: "high",
    };
  }),
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

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
                   upvotes, replies, posts, subscriptions, ai_usage_logs, users,
                   badges, universities CASCADE`
  );
  await app.close();
  await prisma.$disconnect();
  await pool.end();
});

afterEach(async () => {
  await pool.query("DELETE FROM posts");
  await pool.query("DELETE FROM users");
  await pool.query("DELETE FROM ai_usage_logs");
  resetRateLimit();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerVerifyAndLogin(email: string, password = "securePass1") {
  await app.inject({ method: "POST", url: "/auth/register", payload: { email, password } });
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

// ─── POST /ai/ask ─────────────────────────────────────────────────────────────

describe("POST /ai/ask", () => {
  // ── Authentication ──────────────────────────────────────────────────────────

  it("returns 401 when request has no auth cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      payload: { query: "How do I renew my student visa in Germany?" },
    });

    expect(res.statusCode).toBe(401);
  });

  // ── Request validation ──────────────────────────────────────────────────────

  it("returns 400 when query is shorter than 10 characters", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("ai-short@tu-berlin.de");

    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: { query: "too short" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when query field is missing", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("ai-missing@tu-berlin.de");

    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  // ── No matching posts ───────────────────────────────────────────────────────

  it("returns 200 with confidence 'none' and null answer when no posts match the query", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("ai-none@tu-berlin.de");

    // DB is empty — retrieval will return [], mock returns confidence "none"
    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: { query: "xyzzy foobarbaz nonexistent topic" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { answer: null; sources: []; confidence: string };
    expect(body.confidence).toBe("none");
    expect(body.answer).toBeNull();
    expect(body.sources).toEqual([]);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("returns 200 with answer and sources when matching posts exist in the database", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-happy@tu-berlin.de");

    // Create a post whose content will match the FTS query below.
    // Use exact keywords rather than natural-language phrasing to avoid
    // stemmer mismatches (e.g. "register" vs "registration" stem differently).
    await prisma.post.create({
      data: {
        content: "student health insurance krankenkasse registration tips Germany",
        category: "DailyLifeSupport",
        authorId: userId,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: { query: "student health insurance registration Germany" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      answer: string;
      sources: Array<{ id: string; content: string; category: string }>;
      confidence: string;
    };
    expect(typeof body.answer).toBe("string");
    expect(body.answer!.length).toBeGreaterThan(0);
    expect(body.sources).toBeInstanceOf(Array);
    expect(body.sources.length).toBeGreaterThan(0);
    expect(["high", "low"]).toContain(body.confidence);
    // Sources must carry the required shape
    expect(body.sources[0]).toHaveProperty("id");
    expect(body.sources[0]).toHaveProperty("content");
    expect(body.sources[0]).toHaveProperty("category");
    expect(body.sources[0]).toHaveProperty("author");
  });

  // ── OR fallback for conversational / mixed-language queries ─────────────────

  it("finds posts via OR fallback when conversational opener prevents AND match", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-orfallback@tu-berlin.de");

    await prisma.post.create({
      data: {
        content: "python course beginner tutorial resources",
        category: "Academic",
        authorId: userId,
      },
    });

    // "ti bi" are short (filtered) and "znayet" is non-English noise — only
    // "python", "course", "znayet" pass the length filter.
    // The AND query ('python' & 'cours' & 'znayet') won't match.
    // The OR fallback ('python' OR 'course' OR 'znayet') must find the post.
    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: { query: "ti bi python course znayet" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { answer: string | null; sources: unknown[]; confidence: string };
    expect(body.confidence).not.toBe("none");
    expect(body.sources.length).toBeGreaterThan(0);
  });

  // ── Rate limiting ───────────────────────────────────────────────────────────

  it("returns 429 on the 11th request within the same rate-limit window", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("ai-ratelimit@tu-berlin.de");

    const payload = { query: "xyzzy foobarbaz nonexistent topic nomatches" };
    const headers = { cookie: cookieHeader };

    // First 10 requests must all succeed (2xx)
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ method: "POST", url: "/ai/ask", headers, payload });
      expect(res.statusCode).toBe(200);
    }

    // 11th request must be rejected
    const res = await app.inject({ method: "POST", url: "/ai/ask", headers, payload });
    expect(res.statusCode).toBe(429);
    const body = res.json() as { code: string; message: string };
    expect(body.code).toBe("rate_limit_burst");
    expect(typeof body.message).toBe("string");
    const retryAfter = Number(res.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  // ── Daily cap (free users) ──────────────────────────────────────────────────

  it("allows a free user to make up to 10 queries per day", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("ai-dailycap-ok@tu-berlin.de");

    const payload = { query: "xyzzy foobarbaz nonexistent topic nomatches" };
    const headers = { cookie: cookieHeader };

    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ method: "POST", url: "/ai/ask", headers, payload });
      expect(res.statusCode).toBe(200);
      // Reset burst limiter between requests so only the daily cap is being tested
      resetRateLimit();
    }
  });

  it("returns 429 with daily-limit message on the 11th query for a free user", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("ai-dailycap-block@tu-berlin.de");

    const payload = { query: "xyzzy foobarbaz nonexistent topic nomatches" };
    const headers = { cookie: cookieHeader };

    for (let i = 0; i < 10; i++) {
      await app.inject({ method: "POST", url: "/ai/ask", headers, payload });
      resetRateLimit();
    }

    const res = await app.inject({ method: "POST", url: "/ai/ask", headers, payload });
    expect(res.statusCode).toBe(429);
    const body = res.json() as { code: string; message: string };
    expect(body.code).toBe("rate_limit_daily");
    expect(body.message).toBe("Daily AI limit reached — upgrade to Premium for unlimited access");
    const retryAfter = Number(res.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(86400);
  });

  // ── Increment after success ─────────────────────────────────────────────────

  it("does not consume daily quota when generateAiAnswer throws", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-noinc-fail@tu-berlin.de");

    vi.mocked(generateAiAnswer).mockRejectedValueOnce(new Error("OpenAI down"));

    const payload = { query: "xyzzy foobarbaz nonexistent topic nomatches" };
    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload,
    });

    expect(res.statusCode).toBe(500);

    const log = await prisma.aiUsageLog.findUnique({
      where: { userId_date: { userId, date: new Date(new Date().setUTCHours(0, 0, 0, 0)) } },
    });
    expect(log).toBeNull();
  });

  it("increments daily quota exactly once on a successful request", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-noinc-ok@tu-berlin.de");

    const payload = { query: "xyzzy foobarbaz nonexistent topic nomatches" };
    await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload,
    });

    const log = await prisma.aiUsageLog.findUnique({
      where: { userId_date: { userId, date: new Date(new Date().setUTCHours(0, 0, 0, 0)) } },
    });
    expect(log?.count).toBe(1);
  });

  it("does not block a premium user regardless of query count", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-premium@tu-berlin.de");

    await prisma.subscription.update({
      where: { userId },
      data: { status: "premium" },
    });

    const payload = { query: "xyzzy foobarbaz nonexistent topic nomatches" };
    const headers = { cookie: cookieHeader };

    for (let i = 0; i < 15; i++) {
      const res = await app.inject({ method: "POST", url: "/ai/ask", headers, payload });
      expect(res.statusCode).toBe(200);
      resetRateLimit();
    }
  });

  // ── Surface splitting ───────────────────────────────────────────────────────

  it("free + inline: returns FTS-only result with answer=null and does not consume quota", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-inline-free@tu-berlin.de");

    await prisma.post.create({
      data: {
        content: "student health insurance krankenkasse registration tips Germany",
        category: "DailyLifeSupport",
        authorId: userId,
      },
    });

    vi.mocked(generateAiAnswer).mockClear();

    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: { query: "student health insurance registration Germany", source: "inline" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { answer: null; sources: unknown[]; confidence: string };
    expect(body.answer).toBeNull();
    expect(body.sources.length).toBeGreaterThan(0);
    expect(["high", "low"]).toContain(body.confidence);
    expect(vi.mocked(generateAiAnswer)).not.toHaveBeenCalled();

    const log = await prisma.aiUsageLog.findUnique({
      where: { userId_date: { userId, date: new Date(new Date().setUTCHours(0, 0, 0, 0)) } },
    });
    expect(log).toBeNull();
  });

  it("free + ask: returns full RAG result and consumes quota", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-ask-free@tu-berlin.de");

    vi.mocked(generateAiAnswer).mockClear();

    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: { query: "xyzzy foobarbaz nonexistent topic nomatches", source: "ask" },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(generateAiAnswer)).toHaveBeenCalledOnce();

    const log = await prisma.aiUsageLog.findUnique({
      where: { userId_date: { userId, date: new Date(new Date().setUTCHours(0, 0, 0, 0)) } },
    });
    expect(log?.count).toBe(1);
  });

  it("premium + inline: returns full RAG result (not FTS-only)", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-inline-premium@tu-berlin.de");

    await prisma.subscription.update({ where: { userId }, data: { status: "premium" } });

    vi.mocked(generateAiAnswer).mockClear();

    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: { query: "xyzzy foobarbaz nonexistent topic nomatches", source: "inline" },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(generateAiAnswer)).toHaveBeenCalledOnce();
  });

  it("premium + ask: returns full RAG result", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-ask-premium@tu-berlin.de");

    await prisma.subscription.update({ where: { userId }, data: { status: "premium" } });

    vi.mocked(generateAiAnswer).mockClear();

    const res = await app.inject({
      method: "POST",
      url: "/ai/ask",
      headers: { cookie: cookieHeader },
      payload: { query: "xyzzy foobarbaz nonexistent topic nomatches", source: "ask" },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(generateAiAnswer)).toHaveBeenCalledOnce();
  });
});

// ─── GET /ai/usage ────────────────────────────────────────────────────────────

describe("GET /ai/usage", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/ai/usage" });
    expect(res.statusCode).toBe(401);
  });

  it("returns used=0 and limit=10 for a free user with no queries today", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("ai-usage-fresh@tu-berlin.de");

    const res = await app.inject({
      method: "GET",
      url: "/ai/usage",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { used: number; limit: number };
    expect(body.used).toBe(0);
    expect(body.limit).toBe(10);
  });

  it("increments used count after each query for a free user", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("ai-usage-count@tu-berlin.de");

    const payload = { query: "xyzzy foobarbaz nonexistent topic nomatches" };
    const headers = { cookie: cookieHeader };

    await app.inject({ method: "POST", url: "/ai/ask", headers, payload });
    resetRateLimit();
    await app.inject({ method: "POST", url: "/ai/ask", headers, payload });

    const res = await app.inject({ method: "GET", url: "/ai/usage", headers });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { used: number; limit: number };
    expect(body.used).toBe(2);
    expect(body.limit).toBe(10);
  });

  it("returns used=null and limit=null for a premium user", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("ai-usage-premium@tu-berlin.de");

    await prisma.subscription.update({
      where: { userId },
      data: { status: "premium" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/ai/usage",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { used: null; limit: null };
    expect(body.used).toBeNull();
    expect(body.limit).toBeNull();
  });
});
