import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";

describe("rate limiting", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ enableRateLimit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 429 with a stable code and Retry-After header once a general route exceeds the global limit", async () => {
    let limited: Awaited<ReturnType<typeof app.inject>> | undefined;
    for (let i = 0; i < 105; i++) {
      const res = await app.inject({ method: "GET", url: "/health" });
      if (res.statusCode === 429) {
        limited = res;
        break;
      }
    }

    expect(limited).toBeDefined();
    expect(limited?.statusCode).toBe(429);
    expect(limited?.json()).toEqual({ code: "rate_limited", message: expect.any(String) });
    expect(limited?.headers["retry-after"]).toBeDefined();
  });

  it("rate-limits /auth/login more aggressively than the global default", async () => {
    let limited: Awaited<ReturnType<typeof app.inject>> | undefined;
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "nobody@example.com", password: "wrong-password" },
      });
      if (res.statusCode === 429) {
        limited = res;
        break;
      }
    }

    expect(limited).toBeDefined();
    expect(limited?.json()).toEqual({ code: "rate_limited", message: expect.any(String) });
  });

  it("rate-limits /auth/forgot-password more aggressively than the global default", async () => {
    let limited: Awaited<ReturnType<typeof app.inject>> | undefined;
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email: `nobody-${i}@example.com` },
      });
      if (res.statusCode === 429) {
        limited = res;
        break;
      }
    }

    expect(limited).toBeDefined();
    expect(limited?.json()).toEqual({ code: "rate_limited", message: expect.any(String) });
  });

  it("rate-limits /auth/reset-password more aggressively than the global default", async () => {
    let limited: Awaited<ReturnType<typeof app.inject>> | undefined;
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/reset-password",
        payload: { token: `wrong-token-${i}`, newPassword: "somePassword1" },
      });
      if (res.statusCode === 429) {
        limited = res;
        break;
      }
    }

    expect(limited).toBeDefined();
    expect(limited?.json()).toEqual({ code: "rate_limited", message: expect.any(String) });
  });

  it("does not apply the global limiter to /ai/* routes", async () => {
    for (let i = 0; i < 105; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/ai/ask",
        payload: { query: "does this even matter for an unauthenticated request" },
      });
      // Unauthenticated, so every request should fail auth (401) — never 429.
      // A 429 here would mean the global limiter wrongly applied to an
      // excluded route.
      expect(res.statusCode).toBe(401);
    }
  });
});
