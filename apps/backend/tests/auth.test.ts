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
  // Clean users between tests but keep reference data
  await pool.query("DELETE FROM users");
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe("POST /auth/register", () => {
  it("creates an unverified user with a known university domain", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "alice@tu-berlin.de",
        password: "securePass1",
        firstName: "Alice",
        lastName: "Weber",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      message: expect.stringContaining("verify your email"),
    });

    const user = await prisma.user.findUnique({
      where: { email: "alice@tu-berlin.de" },
    });
    expect(user).not.toBeNull();
    expect(user!.isVerified).toBe(false);
    expect(user!.universityId).not.toBeNull();
    expect(user!.emailVerificationToken).not.toBeNull();
    expect(user!.firstName).toBe("Alice");
    expect(user!.lastName).toBe("Weber");
  });

  it("returns 400 when firstName or lastName is missing", async () => {
    const missingFirstName = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "noname@tu-berlin.de", password: "securePass1", lastName: "Weber" },
    });
    expect(missingFirstName.statusCode).toBe(400);

    const missingLastName = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "noname@tu-berlin.de", password: "securePass1", firstName: "Alice" },
    });
    expect(missingLastName.statusCode).toBe(400);

    const user = await prisma.user.findUnique({ where: { email: "noname@tu-berlin.de" } });
    expect(user).toBeNull();
  });

  it("persists optional studyProgramme, semester, and languages when provided", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "academic@tu-berlin.de",
        password: "securePass1",
        firstName: "Dana",
        lastName: "Iyer",
        studyProgramme: "Computer Science",
        semester: 4,
        languages: ["English", "German"],
      },
    });

    expect(res.statusCode).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: "academic@tu-berlin.de" } });
    expect(user!.studyProgramme).toBe("Computer Science");
    expect(user!.semester).toBe(4);
    expect(user!.languages).toEqual(["English", "German"]);
  });

  it("registers successfully without studyProgramme, semester, or languages", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "no-academic@tu-berlin.de",
        password: "securePass1",
        firstName: "Eve",
        lastName: "Klein",
      },
    });

    expect(res.statusCode).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: "no-academic@tu-berlin.de" } });
    expect(user!.studyProgramme).toBeNull();
    expect(user!.semester).toBeNull();
    expect(user!.languages).toEqual([]);
  });

  it("creates a free subscription for the registered user", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "sub-test@tu-berlin.de",
        password: "securePass1",
        firstName: "Sub",
        lastName: "Test",
      },
    });

    const user = await prisma.user.findUnique({
      where: { email: "sub-test@tu-berlin.de" },
    });
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user!.id },
    });

    expect(subscription).not.toBeNull();
    expect(subscription!.status).toBe("free");
    expect(subscription!.endDate).toBeNull();
  });

  it("returns 422 and creates no user for an unknown domain", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "bob@unknown-uni.de",
        password: "securePass1",
        firstName: "Bob",
        lastName: "Nobody",
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ message: "Only university email addresses are allowed." });

    const user = await prisma.user.findUnique({
      where: { email: "bob@unknown-uni.de" },
    });
    expect(user).toBeNull();
  });

  it("returns 409 for a duplicate email", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "dup@tu-berlin.de",
        password: "securePass1",
        firstName: "Dup",
        lastName: "User",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "dup@tu-berlin.de",
        password: "securePass1",
        firstName: "Dup",
        lastName: "User",
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ message: "Email already registered" });
  });

  it("returns 400 for a missing password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@tu-berlin.de", firstName: "Test", lastName: "User" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for a password shorter than 8 characters", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "test@tu-berlin.de",
        password: "short",
        firstName: "Test",
        lastName: "User",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /auth/verify-email ───────────────────────────────────────────────────

describe("GET /auth/verify-email", () => {
  it("activates the account for a valid unexpired token", async () => {
    // Register first to get a user + token
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "carol@tu-berlin.de",
        password: "securePass1",
        firstName: "Carol",
        lastName: "Nguyen",
      },
    });

    const user = await prisma.user.findUnique({
      where: { email: "carol@tu-berlin.de" },
    });
    const token = user!.emailVerificationToken!;

    const res = await app.inject({
      method: "GET",
      url: `/auth/verify-email?token=${token}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message: "Email verified successfully." });

    const verified = await prisma.user.findUnique({
      where: { email: "carol@tu-berlin.de" },
    });
    expect(verified!.isVerified).toBe(true);
    expect(verified!.emailVerificationToken).toBeNull();
  });

  it("returns 400 for an invalid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/verify-email?token=totally-wrong-token",
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ message: "Invalid verification token." });
  });

  it("returns 400 for an expired token", async () => {
    // Create a user with an already-expired token directly in DB
    const user = await prisma.user.create({
      data: {
        email: "expired@tu-berlin.de",
        passwordHash: "hash",
        emailVerificationToken: "expired-token-abc",
        emailVerificationExpiry: new Date(Date.now() - 1000),
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/auth/verify-email?token=${user.emailVerificationToken}`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      message: expect.stringContaining("expired"),
    });
  });

  it("returns 400 when token query param is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/verify-email",
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe("POST /auth/login", () => {
  async function registerAndVerify(email: string, password: string) {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password, firstName: "Test", lastName: "User" },
    });
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.user.update({
      where: { id: user!.id },
      data: { isVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
    });
    return user!;
  }

  it("returns 200 and sets httpOnly cookies on valid credentials", async () => {
    await registerAndVerify("login-ok@tu-berlin.de", "securePass1");

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "login-ok@tu-berlin.de", password: "securePass1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: "login-ok@tu-berlin.de" } });

    const cookies = res.headers["set-cookie"] as string | string[];
    const cookieList = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieList.some((c) => c.startsWith("access_token="))).toBe(true);
    expect(cookieList.some((c) => c.startsWith("refresh_token="))).toBe(true);
    expect(cookieList.every((c) => c.includes("HttpOnly"))).toBe(true);
  });

  it("returns 401 for wrong password", async () => {
    await registerAndVerify("wrong-pass@tu-berlin.de", "securePass1");

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "wrong-pass@tu-berlin.de", password: "wrongPassword" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ message: expect.stringContaining("Invalid") });
  });

  it("returns 401 for non-existent email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@tu-berlin.de", password: "securePass1" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for unverified account", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "unverified@tu-berlin.de",
        password: "securePass1",
        firstName: "Unverified",
        lastName: "User",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "unverified@tu-berlin.de", password: "securePass1" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ message: expect.stringContaining("verify") });
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

describe("GET /auth/me", () => {
  async function loginAndGetCookies(email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
    });
    const cookies = res.headers["set-cookie"] as string | string[];
    return Array.isArray(cookies) ? cookies.join("; ") : cookies;
  }

  async function registerVerifyAndLogin(email: string, password: string) {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password, firstName: "Test", lastName: "User" },
    });
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.user.update({
      where: { id: user!.id },
      data: { isVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
    });
    return loginAndGetCookies(email, password);
  }

  it("returns current user when access token is valid", async () => {
    const cookieHeader = await registerVerifyAndLogin("me-ok@tu-berlin.de", "securePass1");

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: "me-ok@tu-berlin.de" } });
  });

  it("includes subscription in the response with status free", async () => {
    const cookieHeader = await registerVerifyAndLogin("me-sub@tu-berlin.de", "securePass1");

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ user: { subscription: { status: string; startDate: string; endDate: string | null } } }>();
    expect(body.user.subscription).not.toBeNull();
    expect(body.user.subscription!.status).toBe("free");
    expect(body.user.subscription!.startDate).toBeTruthy();
    expect(body.user.subscription!.endDate).toBeNull();
  });

  it("returns 401 when no cookies are present", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("issues a new access token when access token is expired but refresh token is valid", async () => {
    const cookieHeader = await registerVerifyAndLogin("me-refresh@tu-berlin.de", "securePass1");

    // Extract just the refresh_token cookie
    const allCookies = (Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader]).flatMap((c) =>
      c.split(";").map((p) => p.trim())
    );
    const refreshCookie = allCookies.find((c) => c.startsWith("refresh_token="));
    expect(refreshCookie).toBeDefined();

    // Call /auth/me with only the refresh cookie (no access token)
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: refreshCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: "me-refresh@tu-berlin.de" } });

    // A new access_token cookie should be set
    const setCookies = res.headers["set-cookie"] as string | string[];
    const setCookieList = Array.isArray(setCookies) ? setCookies : [setCookies ?? ""];
    expect(setCookieList.some((c) => c.startsWith("access_token="))).toBe(true);
  });
});

// ─── POST /auth/logout ───────────────────────────────────────────────────────

describe("POST /auth/logout", () => {
  it("clears auth cookies and removes refresh token from DB", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "logout@tu-berlin.de",
        password: "securePass1",
        firstName: "Logout",
        lastName: "User",
      },
    });
    const user = await prisma.user.findUnique({ where: { email: "logout@tu-berlin.de" } });
    await prisma.user.update({
      where: { id: user!.id },
      data: { isVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "logout@tu-berlin.de", password: "securePass1" },
    });
    const cookies = loginRes.headers["set-cookie"] as string | string[];
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    const logoutRes = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: cookieHeader },
    });

    expect(logoutRes.statusCode).toBe(200);

    // Refresh token should be cleared from DB
    const updatedUser = await prisma.user.findUnique({ where: { email: "logout@tu-berlin.de" } });
    expect(updatedUser!.refreshTokenHash).toBeNull();

    // Cookies should be cleared (empty value)
    const setCookies = logoutRes.headers["set-cookie"] as string | string[];
    const setCookieList = Array.isArray(setCookies) ? setCookies : [setCookies ?? ""];
    expect(
      setCookieList.some((c) => c.startsWith("access_token=;") || c.startsWith("access_token="))
    ).toBe(true);
  });
});
