import { describe, it, expect } from "vitest";
import { isDatabaseUnavailableError } from "../src/modules/db-errors.js";

describe("isDatabaseUnavailableError", () => {
  it("is true for a pg ECONNREFUSED driver error", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });
    expect(isDatabaseUnavailableError(err)).toBe(true);
  });

  it("is true for Prisma P1001 (can't reach database server)", () => {
    const err = Object.assign(new Error("Can't reach database server at localhost:5432"), {
      name: "PrismaClientKnownRequestError",
      code: "P1001",
    });
    expect(isDatabaseUnavailableError(err)).toBe(true);
  });

  it("is true for a PrismaClientInitializationError", () => {
    const err = Object.assign(new Error("Failed to initialize the Prisma client"), {
      name: "PrismaClientInitializationError",
    });
    expect(isDatabaseUnavailableError(err)).toBe(true);
  });

  it("is true when the connection error is wrapped in a cause chain", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    const err = Object.assign(new Error("prisma query failed"), { cause });
    expect(isDatabaseUnavailableError(err)).toBe(true);
  });

  it("is false for a unique-constraint violation (P2002)", () => {
    const err = Object.assign(new Error("Unique constraint failed"), {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
    expect(isDatabaseUnavailableError(err)).toBe(false);
  });

  it("is false for an ordinary application error", () => {
    expect(isDatabaseUnavailableError(new Error("something else went wrong"))).toBe(false);
  });

  it("is false for null / undefined", () => {
    expect(isDatabaseUnavailableError(null)).toBe(false);
    expect(isDatabaseUnavailableError(undefined)).toBe(false);
  });
});
