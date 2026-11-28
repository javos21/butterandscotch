/** Highest menu price staff can set: 10,000. */
export const PRICE_MAX_CENTS = 1_000_000;

/**
 * Turns a menu price typed by staff ("45", "45.1", "45.10") into integer cents, from 0 to 10,000.
 * Returns null for anything that is not a plain amount with at most two decimals, or that is out of
 * range. Cents come from rounding the parsed amount, so no float drift leaks through.
 */
export function parsePriceCents(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return cents >= 0 && cents <= PRICE_MAX_CENTS ? cents : null;
}
