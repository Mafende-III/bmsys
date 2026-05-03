/**
 * Format an integer amount as RWF currency.
 * No decimals, comma thousands separator.
 *   1500000 -> "1,500,000 RWF"
 */
export function formatRWF(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} RWF`;
}

/**
 * Parse a user-typed RWF amount back into an integer.
 *   "1,500,000" -> 1500000
 *   "1,500,000 RWF" -> 1500000
 */
export function parseRWF(input: string): number {
  const cleaned = input.replace(/[^0-9-]/g, "");
  const n = parseInt(cleaned, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Could not parse RWF amount from: ${input}`);
  }
  return n;
}
