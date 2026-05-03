import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    testTimeout: 30000,
    // Tests run sequentially because they share one Postgres test DB
    // (bmsys_test). Setup file rewrites DATABASE_URL -> TEST_DATABASE_URL.
    fileParallelism: false,
    setupFiles: ["./src/tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
