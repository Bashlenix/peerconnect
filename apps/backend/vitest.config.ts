import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Test files share a Postgres test DB; run them sequentially to prevent
    // one file's afterAll TRUNCATE from racing with another file's queries.
    fileParallelism: false,
    // Must run before any test file's imports (see tests/setup-env.ts) so
    // DATABASE_URL points at the test DB before src/db.ts's dotenv import fires.
    setupFiles: ["./tests/setup-env.ts"],
  },
});
