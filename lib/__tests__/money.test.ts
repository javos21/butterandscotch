import { describe, expect, test } from "vitest";
import { formatMoney, formatPrice, lineTotal, sumCents } from "@/lib/money";

describe("formatMoney", () => {
  test("formats cents as  with two decimals", () => {
    expect(formatMoney(30000)).toBe("300.00");
    expect(formatMoney(4550)).toBe("45.50");
  });
});

describe("formatPrice", () => {
  test("drops .00 from whole amounts", () => {
    expect(formatPrice(30000)).toBe("300");
  });
  test("keeps cents when present", () => {
    expect(formatPrice(4550)).toBe("45.50");
  });
});

describe("sumCents", () => {
  test("adds values", () => {
    expect(sumCents([100, 250, 5])).toBe(355);
  });
  test("empty list is zero", () => {
    expect(sumCents([])).toBe(0);
  });
});

describe("lineTotal", () => {
  test("multiplies unit price by quantity", () => {
    expect(lineTotal(5000, 3)).toBe(15000);
  });
});
