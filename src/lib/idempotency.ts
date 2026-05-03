import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TTL_DAYS = 7;

/**
 * Memoize the result of `fn` against a (key, endpoint) pair via the
 * IdempotencyKey table. Subsequent calls with the same key+endpoint
 * return the cached result without re-running. A different endpoint
 * reusing a key throws — catches form-action wiring bugs early.
 *
 * If `fn` throws, no key is persisted, so retries with the same key
 * re-run. Expired keys are deleted and re-run as well.
 *
 * Race caveat: two concurrent calls with the same key may both run
 * `fn` before either persists. Acceptable for owner-only internal
 * use; revisit when adding external endpoints (subscriptions, online).
 */
export async function withIdempotency<T>(
  key: string,
  endpoint: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });

  if (existing) {
    if (existing.endpoint !== endpoint) {
      throw new Error(
        `Idempotency key reused across endpoints (${existing.endpoint} -> ${endpoint})`,
      );
    }
    if (existing.expiresAt > new Date()) {
      return existing.resultJson as T;
    }
    await prisma.idempotencyKey.delete({ where: { key } });
  }

  const result = await fn();

  await prisma.idempotencyKey.create({
    data: {
      key,
      endpoint,
      resultJson: result as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return result;
}
