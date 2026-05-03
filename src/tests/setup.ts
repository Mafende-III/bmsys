/**
 * Vitest setup: route every test through TEST_DATABASE_URL.
 *
 * The Prisma singleton in src/lib/prisma.ts reads DATABASE_URL on first
 * import. We rewrite DATABASE_URL here BEFORE any test imports the
 * singleton, so app code (operations.ts etc.) and test code agree on the
 * test database. The dev DB at DATABASE_URL is never touched by tests.
 */
import { config } from "dotenv";

config(); // populate process.env from .env

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL not set. Add it to .env (e.g. postgresql://.../bmsys_test).",
  );
}
process.env.DATABASE_URL = testUrl;
