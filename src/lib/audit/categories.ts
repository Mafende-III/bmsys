/**
 * Curated security-event categories. New events get added here and
 * written into AuditLog.category as a string. Owner-facing labels
 * live alongside so the /audit page reads the same vocabulary.
 *
 * NOT every audit-log row has a category — plain CRUD writes leave
 * it null. Use a category only for things the owner should be able
 * to spot at a glance.
 */

export const AUDIT_CATEGORIES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "CASH_LARGE_VARIANCE",
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_LABEL: Record<AuditCategory, string> = {
  LOGIN_SUCCESS: "Sign-in",
  LOGIN_FAILED: "Failed sign-in",
  CASH_LARGE_VARIANCE: "Big cash variance",
};

export const AUDIT_TONE: Record<AuditCategory, "neutral" | "warn" | "alert"> = {
  LOGIN_SUCCESS: "neutral",
  LOGIN_FAILED: "alert",
  CASH_LARGE_VARIANCE: "warn",
};

/**
 * Threshold above which a closed cash session is flagged as a large
 * variance. RWF, absolute value. Set conservatively — small shops
 * notice 500.
 */
export const CASH_VARIANCE_ALERT_THRESHOLD = 500;
