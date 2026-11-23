import { timingSafeEqual } from "node:crypto";

/**
 * True when the Authorization header is exactly `Bearer <secret>`. Compared in constant time.
 * An unset secret never matches, so a missing CRON_SECRET locks the route rather than opening it.
 */
export function isCronAuthorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
