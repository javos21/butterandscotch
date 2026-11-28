/**
 * The festive layer (DESIGN.md: a removable garnish). Set `festive` to false after the season and
 * the storefront falls back to the year-round copy, with no "Our Christmas Menu" separator.
 */
export const SEASON = {
  festive: true,
  heroTitle: "T'is the season to treat yourself",
} as const;

export const YEAR_ROUND = {
  heroTitle: "Home bakes, made to order.",
} as const;
