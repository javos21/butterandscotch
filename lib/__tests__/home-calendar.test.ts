import { describe, expect, test } from "vitest";
import { lastDayOfMonth, monthGrid, parseDate, parseMonth, shiftMonth } from "@/lib/admin/home-calendar";

describe("home calendar", () => {
  test("lastDayOfMonth handles short and leap months", () => {
    expect(lastDayOfMonth("2026-02-01")).toBe("2026-02-28");
    expect(lastDayOfMonth("2028-02-01")).toBe("2028-02-29");
    expect(lastDayOfMonth("2026-11-01")).toBe("2026-11-30");
  });

  test("shiftMonth moves across year ends", () => {
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });

  test("monthGrid pads the first week Sunday-first and lists every day", () => {
    // 1 November 2026 is a Sunday, so there is no padding.
    const november = monthGrid("2026-11-01");
    expect(november[0]).toBe("2026-11-01");
    expect(november).toHaveLength(30);

    // 1 December 2026 is a Tuesday, so two blanks come first.
    const december = monthGrid("2026-12-01");
    expect(december.slice(0, 3)).toEqual([null, null, "2026-12-01"]);
    expect(december.at(-1)).toBe("2026-12-31");
  });

  test("parseMonth falls back to today's month when the value is missing or bad", () => {
    expect(parseMonth("2027-03", "2026-11-25")).toBe("2027-03-01");
    expect(parseMonth(undefined, "2026-11-25")).toBe("2026-11-01");
    expect(parseMonth("2027-13", "2026-11-25")).toBe("2026-11-01");
    expect(parseMonth("nonsense", "2026-11-25")).toBe("2026-11-01");
  });

  test("parseDate accepts real dates only", () => {
    expect(parseDate("2026-11-30")).toBe("2026-11-30");
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});
