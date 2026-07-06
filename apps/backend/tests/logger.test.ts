import { describe, it, expect } from "vitest";
import pino from "pino";
import { logger, redactConfig } from "../src/logger.js";

describe("logger", () => {
  it("is silent under NODE_ENV=test so test runs stay quiet", () => {
    expect(logger.level).toBe("silent");
  });

  it("redacts cookies, auth headers, passwords, and set-cookie response headers", () => {
    const lines: string[] = [];
    const stream = {
      write: (chunk: string) => {
        lines.push(chunk);
      },
    };
    const probe = pino({ level: "info", redact: redactConfig }, stream as unknown as NodeJS.WritableStream);

    probe.info({
      req: {
        headers: { cookie: "access_token=super-secret", authorization: "Bearer abc123" },
        body: { email: "student@uni.de", password: "hunter2" },
      },
      res: { headers: { "set-cookie": "refresh_token=another-secret" } },
    });

    const logged = lines.join("");
    expect(logged).not.toContain("super-secret");
    expect(logged).not.toContain("abc123");
    expect(logged).not.toContain("hunter2");
    expect(logged).not.toContain("another-secret");
    expect(logged).toContain("student@uni.de");
  });
});
