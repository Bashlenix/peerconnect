import { vi } from "vitest";

// Runs before any test file (and its imports) are loaded. Must set
// DATABASE_URL before src/db.ts's `import "dotenv/config"` executes —
// dotenv does not override an already-set env var, so this wins.
process.env["DATABASE_URL"] =
  process.env["TEST_DATABASE_URL"] ?? "postgresql://bashi@localhost:5432/peerconnect_test";

// auth-service.ts sends verification emails via nodemailer directly (using
// real Resend credentials from .env). Mock the transport here, once, so no
// test file needs its own mock and no test ever makes a real SMTP call.
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }),
  },
}));
