import { expect, test } from "vitest";
import { formatMonthDay } from "@/lib/format-date";

test("formatMonthDay gives the day with its ordinal suffix", () => {
  expect(formatMonthDay("2026-12-16")).toBe("December 16th");
  expect(formatMonthDay("2026-12-23")).toBe("December 23rd");
  expect(formatMonthDay("2026-12-01")).toBe("December 1st");
  expect(formatMonthDay("2026-12-12")).toBe("December 12th");
  expect(formatMonthDay("2026-12-22")).toBe("December 22nd");
});
