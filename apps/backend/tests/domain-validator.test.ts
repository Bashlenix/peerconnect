import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DomainValidationResult } from "../src/modules/domain-validator.js";

// Must be declared before any import of the module under test
vi.mock("../src/db.js", () => ({
  prisma: {
    university: {
      findFirst: vi.fn(),
    },
  },
}));

// Import after mock declaration so vitest hoisting applies
const { validateEmailDomain } = await import(
  "../src/modules/domain-validator.js"
);
const { prisma } = await import("../src/db.js");

const mockFindFirst = vi.mocked(prisma.university.findFirst);

const TU_BERLIN = { id: "1", name: "TU Berlin", domain: "tu-berlin.de" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("validateEmailDomain", () => {
  it("returns valid=true and university for a known active domain", async () => {
    mockFindFirst.mockResolvedValue(TU_BERLIN as never);

    const result = await validateEmailDomain("student@tu-berlin.de");

    expect(result).toEqual<DomainValidationResult>({
      valid: true,
      university: TU_BERLIN,
    });
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domain: "tu-berlin.de", isActive: true },
      })
    );
  });

  it("returns valid=false for an unknown domain", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await validateEmailDomain("user@unknown-uni.de");

    expect(result).toEqual<DomainValidationResult>({ valid: false });
  });

  it("returns valid=false for an inactive domain", async () => {
    // isActive: false means findFirst (which filters isActive: true) returns null
    mockFindFirst.mockResolvedValue(null);

    const result = await validateEmailDomain("user@inactive-uni.de");

    expect(result).toEqual<DomainValidationResult>({ valid: false });
    // Confirm the query always filters on isActive: true
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it("returns valid=false for a malformed email (no @)", async () => {
    const result = await validateEmailDomain("notanemail");
    expect(result).toEqual<DomainValidationResult>({ valid: false });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns valid=false for a malformed email (@ at start)", async () => {
    const result = await validateEmailDomain("@tu-berlin.de");
    expect(result).toEqual<DomainValidationResult>({ valid: false });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns valid=false for a subdomain variant (student.tu-berlin.de)", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await validateEmailDomain("user@student.tu-berlin.de");

    expect(result).toEqual<DomainValidationResult>({ valid: false });
    // The query fires with the subdomain, which won't match the base domain record
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domain: "student.tu-berlin.de", isActive: true },
      })
    );
  });
});
