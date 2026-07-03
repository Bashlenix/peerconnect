import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Simulate the database being unreachable by making the auth service throw a
// Prisma "can't reach database server" error. This keeps the test independent
// of any real (broken) DB while exercising the app's global error handler.
const connectionError = Object.assign(
  new Error("Can't reach database server at `localhost:5432`"),
  { name: "PrismaClientKnownRequestError", code: "P1001" }
);

vi.mock("../src/modules/auth-service.js", () => ({
  login: vi.fn(async () => {
    throw connectionError;
  }),
  register: vi.fn(async () => {
    throw connectionError;
  }),
  verifyEmail: vi.fn(),
  verifyRefreshToken: vi.fn(),
  logout: vi.fn(),
}));

import { buildApp } from "../src/app.js";

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("database unavailable → 503 service_unavailable", () => {
  it("POST /auth/login returns 503 with a stable code when the DB is unreachable", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@tu-berlin.de", password: "securePass1" },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "service_unavailable" });
    expect(res.json<{ message: string }>().message).toBeTruthy();
  });

  it("POST /auth/register returns 503 with a stable code when the DB is unreachable", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "user@tu-berlin.de", password: "securePass1" },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "service_unavailable" });
  });

  it("does not leak the raw Prisma error text", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@tu-berlin.de", password: "securePass1" },
    });

    expect(res.body).not.toContain("prisma");
    expect(res.body).not.toContain("Can't reach database server");
  });
});
