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
    `TRUNCATE TABLE ads, subscriptions, users, badges, universities CASCADE`
  );
  await app.close();
  await prisma.$disconnect();
  await pool.end();
});

afterEach(async () => {
  await pool.query("DELETE FROM ads");
  await pool.query("DELETE FROM users");
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerVerifyAndLogin(email: string, password = "securePass1") {
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

function makeAd(overrides: Partial<{
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string;
  advertiserName: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}> = {}) {
  return {
    title: "Test Ad",
    body: "Ad body text",
    imageUrl: null,
    linkUrl: "https://example.com",
    advertiserName: "Test Advertiser",
    isActive: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /ads", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await app.inject({ method: "GET", url: "/ads" });
    expect(res.statusCode).toBe(401);
  });

  it("returns empty array for premium users", async () => {
    const { cookieHeader, userId } = await registerVerifyAndLogin("premium@tu-berlin.de");
    await prisma.subscription.update({
      where: { userId },
      data: { status: "premium" },
    });
    await prisma.ad.create({ data: makeAd() });

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ads: [] });
  });

  it("returns active ads for free users", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("free@tu-berlin.de");
    await prisma.ad.create({ data: makeAd({ title: "Free Ad", advertiserName: "Sponsor A" }) });

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ ads: { title: string; advertiserName: string }[] }>();
    expect(body.ads).toHaveLength(1);
    expect(body.ads[0]).toMatchObject({ title: "Free Ad", advertiserName: "Sponsor A" });
  });

  it("returns empty array for free users when no active ads exist", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("free2@tu-berlin.de");

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ads: [] });
  });

  it("excludes ads where isActive is false", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("free3@tu-berlin.de");
    await prisma.ad.create({ data: makeAd({ isActive: false }) });

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ ads: unknown[] }>().ads).toHaveLength(0);
  });

  it("excludes ads where endsAt is in the past", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("free4@tu-berlin.de");
    const yesterday = new Date(Date.now() - 86400 * 1000);
    await prisma.ad.create({ data: makeAd({ endsAt: yesterday }) });

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ ads: unknown[] }>().ads).toHaveLength(0);
  });

  it("excludes ads where startsAt is in the future", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("free5@tu-berlin.de");
    const tomorrow = new Date(Date.now() + 86400 * 1000);
    await prisma.ad.create({ data: makeAd({ startsAt: tomorrow }) });

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ ads: unknown[] }>().ads).toHaveLength(0);
  });

  it("includes ads with open-ended date bounds (null startsAt and endsAt)", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("free6@tu-berlin.de");
    await prisma.ad.create({ data: makeAd({ startsAt: null, endsAt: null }) });

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ ads: unknown[] }>().ads).toHaveLength(1);
  });

  it("includes ad with imageUrl when present", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("free7@tu-berlin.de");
    await prisma.ad.create({
      data: makeAd({ imageUrl: "https://example.com/banner.png" }),
    });

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ ads: { imageUrl: string | null }[] }>();
    expect(body.ads[0]?.imageUrl).toBe("https://example.com/banner.png");
  });

  it("response shape contains required fields", async () => {
    const { cookieHeader } = await registerVerifyAndLogin("free8@tu-berlin.de");
    await prisma.ad.create({
      data: makeAd({ title: "ShapeAd", body: "Body", linkUrl: "https://x.com", advertiserName: "X Corp" }),
    });

    const res = await app.inject({
      method: "GET",
      url: "/ads",
      headers: { cookie: cookieHeader },
    });

    const body = res.json<{ ads: Record<string, unknown>[] }>();
    const ad = body.ads[0]!;
    expect(ad).toHaveProperty("id");
    expect(ad).toHaveProperty("title");
    expect(ad).toHaveProperty("body");
    expect(ad).toHaveProperty("imageUrl");
    expect(ad).toHaveProperty("linkUrl");
    expect(ad).toHaveProperty("advertiserName");
  });
});
