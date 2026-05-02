import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";

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

// ─── GET /users/:id ───────────────────────────────────────────────────────────

describe("GET /users/:id", () => {
  it("returns public profile for an existing user", async () => {
    const user = await prisma.user.create({
      data: {
        email: "profile@tu-berlin.de",
        passwordHash: "hash",
        isVerified: true,
        firstName: "Alice",
        lastName: "Müller",
        studyProgramme: "Computer Science",
        semester: 4,
        languages: ["English", "German"],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/users/${user.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: user.id,
      firstName: "Alice",
      lastName: "Müller",
      studyProgramme: "Computer Science",
      semester: 4,
      languages: ["English", "German"],
      replyCount: 0,
      solutionCount: 0,
      badges: [],
    });
  });

  it("does not expose email or passwordHash", async () => {
    const user = await prisma.user.create({
      data: { email: "noleak@tu-berlin.de", passwordHash: "secret-hash", isVerified: true },
    });

    const res = await app.inject({ method: "GET", url: `/users/${user.id}` });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body["email"]).toBeUndefined();
    expect(body["passwordHash"]).toBeUndefined();
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await app.inject({ method: "GET", url: "/users/nonexistent-id" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ message: "User not found" });
  });

  it("counts replies correctly", async () => {
    const author = await prisma.user.create({
      data: { email: "reply-count@tu-berlin.de", passwordHash: "hash", isVerified: true },
    });
    const post = await prisma.post.create({
      data: { content: "A post", category: "Academic", authorId: author.id },
    });
    await prisma.reply.createMany({
      data: [
        { content: "Reply 1", postId: post.id, authorId: author.id },
        { content: "Reply 2", postId: post.id, authorId: author.id },
      ],
    });

    const res = await app.inject({ method: "GET", url: `/users/${author.id}` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ replyCount: 2, solutionCount: 0 });
  });

  it("counts accepted solutions correctly", async () => {
    const author = await prisma.user.create({
      data: { email: "solution-count@tu-berlin.de", passwordHash: "hash", isVerified: true },
    });
    const postAuthor = await prisma.user.create({
      data: { email: "post-author@tu-berlin.de", passwordHash: "hash", isVerified: true },
    });
    const post = await prisma.post.create({
      data: { content: "A post", category: "Academic", authorId: postAuthor.id },
    });
    await prisma.reply.create({
      data: { content: "Solution reply", postId: post.id, authorId: author.id, isSolution: true },
    });
    await prisma.reply.create({
      data: { content: "Normal reply", postId: post.id, authorId: author.id, isSolution: false },
    });

    const res = await app.inject({ method: "GET", url: `/users/${author.id}` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ replyCount: 2, solutionCount: 1 });
  });

  it("includes earned badges", async () => {
    const badge = await prisma.badge.findFirstOrThrow({ where: { name: "First Reply" } });
    const user = await prisma.user.create({
      data: {
        email: "badges@tu-berlin.de",
        passwordHash: "hash",
        isVerified: true,
        userBadges: {
          create: { badgeId: badge.id },
        },
      },
    });

    const res = await app.inject({ method: "GET", url: `/users/${user.id}` });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { badges: Array<{ name: string; description: string; awardedAt: string }> };
    expect(body.badges).toHaveLength(1);
    expect(body.badges[0]).toMatchObject({ name: "First Reply" });
    expect(body.badges[0]!.awardedAt).toBeDefined();
  });
});

// ─── PATCH /users/me ──────────────────────────────────────────────────────────

describe("PATCH /users/me", () => {
  it("updates allowed profile fields", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("patch-me@tu-berlin.de");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { cookie: cookieHeader },
      payload: {
        firstName: "Updated",
        lastName: "User",
        studyProgramme: "Mathematics",
        semester: 3,
        languages: ["English", "French"],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: userId,
      firstName: "Updated",
      lastName: "User",
      studyProgramme: "Mathematics",
      semester: 3,
      languages: ["English", "French"],
    });
  });

  it("ignores email field even if included in body", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("email-locked@tu-berlin.de");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { cookie: cookieHeader },
      payload: { firstName: "Bob", email: "hacker@evil.com" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ firstName: "Bob" });

    const user = await prisma.user.findUnique({ where: { email: "email-locked@tu-berlin.de" } });
    expect(user).not.toBeNull();
  });

  it("allows partial updates — only provided fields change", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("partial-update@tu-berlin.de");
    await prisma.user.update({
      where: { id: userId },
      data: { firstName: "Original", lastName: "Name", semester: 2 },
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { cookie: cookieHeader },
      payload: { firstName: "Changed" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { firstName: string; lastName: string; semester: number };
    expect(body.firstName).toBe("Changed");
    expect(body.lastName).toBe("Name");
    expect(body.semester).toBe(2);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      payload: { firstName: "Ghost" },
    });
    expect(res.statusCode).toBe(401);
  });
});
