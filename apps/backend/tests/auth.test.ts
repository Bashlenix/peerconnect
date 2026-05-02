import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../src/app.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedReferenceData } from "../prisma/seed-data.js";

// Prevent real emails from being sent
vi.mock("../src/modules/email-verification-service.js", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("../src/modules/email-verification-service.js")
    >();
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
  // Clean users between tests but keep reference data
  await pool.query("DELETE FROM users");
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe("POST /auth/register", () => {
  it("creates an unverified user with a known university domain", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "alice@tu-berlin.de", password: "securePass1" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      message: expect.stringContaining("verify your email"),
      requiresManualReview: false,
    });

    const user = await prisma.user.findUnique({
      where: { email: "alice@tu-berlin.de" },
    });
    expect(user).not.toBeNull();
    expect(user!.isVerified).toBe(false);
    expect(user!.requiresManualReview).toBe(false);
    expect(user!.universityId).not.toBeNull();
    expect(user!.emailVerificationToken).not.toBeNull();
  });

  it("creates a user with requiresManualReview=true for an unknown domain", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "bob@unknown-uni.de", password: "securePass1" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ requiresManualReview: true });

    const user = await prisma.user.findUnique({
      where: { email: "bob@unknown-uni.de" },
    });
    expect(user!.requiresManualReview).toBe(true);
    expect(user!.universityId).toBeNull();
  });

  it("returns 409 for a duplicate email", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@tu-berlin.de", password: "securePass1" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@tu-berlin.de", password: "securePass1" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ message: "Email already registered" });
  });

  it("returns 400 for a missing password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@tu-berlin.de" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for a password shorter than 8 characters", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@tu-berlin.de", password: "short" },
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
      payload: { email: "carol@tu-berlin.de", password: "securePass1" },
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
