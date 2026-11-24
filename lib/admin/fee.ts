export const FEE_MAX_CENTS = 100_000;

/**
 * Turns a TT$ amount typed by staff ("45", "45.1", "45.10") into integer cents.
 * Returns null for anything that is not a plain amount with at most two decimals, or that is
 * outside TT$0 to TT$1,000. Cents come from rounding the parsed amount, so no float drift leaks through.
 */
export function parseFeeCents(text: string): number | null {
  return parseMoneyCents(text, FEE_MAX_CENTS);
}

/** Highest menu price staff can set: TT$10,000. */
export const PRICE_MAX_CENTS = 1_000_000;

/** A menu price typed by staff, in integer cents, from TT$0 to TT$10,000. Same rules as parseFeeCents. */
export function parsePriceCents(text: string): number | null {
  return parseMoneyCents(text, PRICE_MAX_CENTS);
}

function parseMoneyCents(text: string, maxCents: number): number | null {
  const trimmed = text.trim().replace(/^TT\$/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return cents >= 0 && cents <= maxCents ? cents : null;
}
