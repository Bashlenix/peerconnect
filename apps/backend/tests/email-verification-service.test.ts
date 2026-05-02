import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db.js", () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

const { generateToken, saveToken, confirmEmail } = await import(
  "../src/modules/email-verification-service.js"
);
const { prisma } = await import("../src/db.js");

const mockUpdate = vi.mocked(prisma.user.update);
const mockFindFirst = vi.mocked(prisma.user.findFirst);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("generateToken", () => {
  it("produces unique tokens on successive calls", () => {
    const tokens = Array.from({ length: 10 }, () => generateToken());
    const unique = new Set(tokens);
    expect(unique.size).toBe(10);
  });

  it("produces a 64-character hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("saveToken", () => {
  it("persists the token on the user and returns an expiry ~24h ahead", async () => {
    mockUpdate.mockResolvedValue({} as never);
    const before = Date.now();

    const expiry = await saveToken("user-1", "abc123");

    const after = Date.now();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        emailVerificationToken: "abc123",
        emailVerificationExpiry: expiry,
      },
    });

    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + twentyFourHoursMs - 100);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + twentyFourHoursMs + 100);
  });
});

describe("confirmEmail", () => {
  it("activates the user and returns success for a valid unexpired token", async () => {
    const futureExpiry = new Date(Date.now() + 60_000);
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      emailVerificationExpiry: futureExpiry,
    } as never);
    mockUpdate.mockResolvedValue({} as never);

    const result = await confirmEmail("valid-token");

    expect(result).toEqual({ success: true, userId: "user-1" });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        isVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });
  });

  it("returns invalid for an unknown token", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await confirmEmail("unknown-token");

    expect(result).toEqual({ success: false, reason: "invalid" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns expired when the token expiry is in the past", async () => {
    const pastExpiry = new Date(Date.now() - 1000);
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      emailVerificationExpiry: pastExpiry,
    } as never);

    const result = await confirmEmail("expired-token");

    expect(result).toEqual({ success: false, reason: "expired" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns expired when emailVerificationExpiry is null", async () => {
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      emailVerificationExpiry: null,
    } as never);

    const result = await confirmEmail("token-without-expiry");

    expect(result).toEqual({ success: false, reason: "expired" });
  });
});
