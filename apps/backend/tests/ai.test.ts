import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";
import { rateLimitMap } from "../src/routes/ai.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../src/modules/email-verification-service.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/modules/email-verification-service.js")>();
  return { ...original, sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
});

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
                   upvotes, replies, posts, subscriptions, users,
                   badges, universities CASCADE`
  );
  await app.close();
  await prisma.$disconnect();
  await pool.end();
});

afterEach(async () => {
  await pool.query("DELETE FROM users");
  rateLimitMap.clear();
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
    const body = res.json() as { message: string };
    expect(typeof body.message).toBe("string");
  });
});
