import { describe, expect, test } from "vitest";
import { parseFeeCents } from "@/lib/admin/fee";

describe("parseFeeCents", () => {
  test("whole amounts become cents", () => {
    expect(parseFeeCents("45")).toBe(4500);
  });

  test("two decimals are kept exactly", () => {
    expect(parseFeeCents("45.10")).toBe(4510);
  });

  test("one decimal is read as tenths of a dollar", () => {
    expect(parseFeeCents("0.1")).toBe(10);
  });

  test("surrounding spaces are ignored", () => {
    expect(parseFeeCents("  12.5 ")).toBe(1250);
  });

  test("the maximum TT$1,000 is accepted", () => {
    expect(parseFeeCents("1000")).toBe(100_000);
  });

  test("an empty string is not a fee", () => {
    expect(parseFeeCents("")).toBeNull();
  });

  test("text is not a fee", () => {
    expect(parseFeeCents("abc")).toBeNull();
  });

  test("more than two decimals is rejected, not rounded", () => {
    expect(parseFeeCents("1000.001")).toBeNull();
    expect(parseFeeCents("12.345")).toBeNull();
  });

  test("an amount above TT$1,000 is rejected", () => {
    expect(parseFeeCents("1000.01")).toBeNull();
  });

  test("negative amounts are rejected", () => {
    expect(parseFeeCents("-5")).toBeNull();
  });
});
