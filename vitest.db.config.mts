import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Database tests: need DATABASE_URL pointing at a migrated, disposable Postgres. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
