import { describe, it, expect } from "vitest";
import { isRateLimitError } from "../src/modules/rate-limit-errors.js";

describe("isRateLimitError", () => {
  it("is true for the object shape @fastify/rate-limit throws", () => {
    expect(isRateLimitError({ code: "rate_limited", message: "Too many requests" })).toBe(true);
  });

  it("is false for a database-unavailable error", () => {
    expect(isRateLimitError(Object.assign(new Error("nope"), { code: "P1001" }))).toBe(false);
  });

  it("is false for an ordinary application error", () => {
    expect(isRateLimitError(new Error("something else went wrong"))).toBe(false);
  });

  it("is false for null / undefined", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});
