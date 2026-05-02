import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Test files share a Postgres test DB; run them sequentially to prevent
    // one file's afterAll TRUNCATE from racing with another file's queries.
    fileParallelism: false,
  },
});
