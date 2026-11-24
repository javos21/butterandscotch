export const FEE_MAX_CENTS = 100_000;

/**
 * Turns a TT$ amount typed by staff ("45", "45.1", "45.10") into integer cents.
 * Returns null for anything that is not a plain amount with at most two decimals, or that is
 * outside TT$0 to TT$1,000. Cents come from rounding the parsed amount, so no float drift leaks through.
 */
export function parseFeeCents(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return cents >= 0 && cents <= FEE_MAX_CENTS ? cents : null;
}
