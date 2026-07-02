import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";

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

  it("exposes topBadgeName", async () => {
    const user = await prisma.user.create({
      data: {
        email: "top-badge@tu-berlin.de",
        passwordHash: "hash",
        isVerified: true,
        topBadgeName: "Trusted Helper",
        topBadgeAwardedAt: new Date(),
      },
    });

    const res = await app.inject({ method: "GET", url: `/users/${user.id}` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ topBadgeName: "Trusted Helper" });
  });

  it("returns null topBadgeName for a user with no badges", async () => {
    const user = await prisma.user.create({
      data: { email: "no-top-badge@tu-berlin.de", passwordHash: "hash", isVerified: true },
    });

    const res = await app.inject({ method: "GET", url: `/users/${user.id}` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ topBadgeName: null });
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

// ─── PATCH /users/me/subscription ──────────────────────────────────────────────

describe("PATCH /users/me/subscription", () => {
  it("upgrades a free user to premium", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("upgrade@tu-berlin.de");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me/subscription",
      headers: { cookie: cookieHeader },
      payload: { status: "premium" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "premium", endDate: null });

    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    expect(subscription?.status).toBe("premium");
  });

  it("downgrades a premium user to free", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("downgrade@tu-berlin.de");
    await prisma.subscription.update({ where: { userId }, data: { status: "premium" } });

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me/subscription",
      headers: { cookie: cookieHeader },
      payload: { status: "free" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "free" });

    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    expect(subscription?.status).toBe("free");
  });

  it("is idempotent when the user is already at the requested status", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("idempotent@tu-berlin.de");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me/subscription",
      headers: { cookie: cookieHeader },
      payload: { status: "free" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "free" });
  });

  it("returns 400 for an invalid status value", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("invalid-status@tu-berlin.de");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me/subscription",
      headers: { cookie: cookieHeader },
      payload: { status: "gold" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/users/me/subscription",
      payload: { status: "premium" },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /users/me/notification-preferences ───────────────────────────────────

describe("GET /users/me/notification-preferences", () => {
  it("returns empty array for a new user with no preferences", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("notif-get-empty@tu-berlin.de");

    const res = await app.inject({
      method: "GET",
      url: "/users/me/notification-preferences",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categories: [] });
  });

  it("returns the user's subscribed categories", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-get-prefs@tu-berlin.de");

    await prisma.notificationPreference.createMany({
      data: [
        { userId, category: "Academic" },
        { userId, category: "Social" },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/users/me/notification-preferences",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { categories: string[] };
    expect(body.categories.sort()).toEqual(["Academic", "Social"]);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/users/me/notification-preferences" });
    expect(res.statusCode).toBe(401);
  });
});

// ─── PUT /users/me/notification-preferences ───────────────────────────────────

describe("PUT /users/me/notification-preferences", () => {
  it("sets notification preferences for the user", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("notif-put-set@tu-berlin.de");

    const res = await app.inject({
      method: "PUT",
      url: "/users/me/notification-preferences",
      headers: { cookie: cookieHeader },
      payload: { categories: ["Academic", "Sport"] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { categories: string[] };
    expect(body.categories.sort()).toEqual(["Academic", "Sport"]);
  });

  it("replaces existing preferences on subsequent PUT", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("notif-put-replace@tu-berlin.de");

    await app.inject({
      method: "PUT",
      url: "/users/me/notification-preferences",
      headers: { cookie: cookieHeader },
      payload: { categories: ["Academic", "Social"] },
    });

    const res = await app.inject({
      method: "PUT",
      url: "/users/me/notification-preferences",
      headers: { cookie: cookieHeader },
      payload: { categories: ["Sport"] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categories: ["Sport"] });
  });

  it("accepts an empty array to clear all preferences", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("notif-put-clear@tu-berlin.de");

    await prisma.notificationPreference.create({ data: { userId, category: "Academic" } });

    const res = await app.inject({
      method: "PUT",
      url: "/users/me/notification-preferences",
      headers: { cookie: cookieHeader },
      payload: { categories: [] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categories: [] });
  });

  it("deduplicates categories in the request body", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("notif-put-dedup@tu-berlin.de");

    const res = await app.inject({
      method: "PUT",
      url: "/users/me/notification-preferences",
      headers: { cookie: cookieHeader },
      payload: { categories: ["Academic", "Academic"] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ categories: ["Academic"] });
  });

  it("returns 400 for an invalid category", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("notif-put-invalid@tu-berlin.de");

    const res = await app.inject({
      method: "PUT",
      url: "/users/me/notification-preferences",
      headers: { cookie: cookieHeader },
      payload: { categories: ["InvalidCategory"] },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/users/me/notification-preferences",
      payload: { categories: ["Academic"] },
    });
    expect(res.statusCode).toBe(401);
  });
});
