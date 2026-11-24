/**
 * The festive layer (DESIGN.md: a removable garnish). Set `festive` to false after the season and
 * the storefront falls back to the year-round copy, with no holly dividers.
 */
export const SEASON = {
  festive: true,
  heroTitle: "Christmas bakes, made to share.",
  heroImage: { src: "/items/orange-almond-cake.webp", alt: "Orange almond cake topped with flaked almonds, beside dried orange slices", width: 1200, height: 802 },
} as const;

export const YEAR_ROUND = {
  heroTitle: "Home bakes, made to order.",
} as const;
