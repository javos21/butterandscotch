import { describe, expect, test } from "vitest";
import {
  BOOKING_HORIZON_DAYS,
  TT_TIME_ZONE,
  addDays,
  dayState,
  earliestDate,
  isAfterLastFulfilment,
  isOrderingClosed,
  trinidadToday,
} from "@/lib/dates";

describe("constants", () => {
  test("Trinidad zone and booking horizon", () => {
    expect(TT_TIME_ZONE).toBe("America/Port_of_Spain");
    expect(BOOKING_HORIZON_DAYS).toBe(90);
  });
});

describe("trinidadToday", () => {
  test("uses the Trinidad date, not UTC", () => {
    const lateEvening = new Date("2026-11-23T03:00:00Z"); // 22 Nov, 11 pm in Trinidad
    expect(trinidadToday(lateEvening)).toBe("2026-11-22");
    expect(earliestDate(lateEvening, 5)).toBe("2026-11-27");
  });
});

describe("earliestDate", () => {
  test("adds the lead days to the Trinidad today", () => {
    expect(earliestDate(new Date("2026-11-23T12:00:00Z"), 5)).toBe("2026-11-28");
  });
});

describe("addDays", () => {
  test("crosses a year boundary", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("dayState", () => {
  const ctx = {
    today: "2026-11-23",
    leadDays: 5,
    unavailable: new Set(["2026-12-03"]),
  };
  test("past days", () => {
    expect(dayState("2026-11-22", ctx)).toBe("past");
  });
  test("days inside the lead time are too soon", () => {
    expect(dayState("2026-11-23", ctx)).toBe("too_soon");
    expect(dayState("2026-11-27", ctx)).toBe("too_soon");
  });
  test("first day after the lead time is available", () => {
    expect(dayState("2026-11-28", ctx)).toBe("available");
  });
  test("unavailable dates", () => {
    expect(dayState("2026-12-03", ctx)).toBe("unavailable");
  });
  test("horizon edge", () => {
    expect(dayState("2027-02-21", ctx)).toBe("available"); // today + 90
    expect(dayState("2027-02-22", ctx)).toBe("beyond"); // today + 91
  });
});

describe("isOrderingClosed", () => {
  test("orders are open on the close date itself, in Trinidad time", () => {
    expect(isOrderingClosed(new Date("2026-12-16T12:00:00Z"), "2026-12-16")).toBe(false);
  });

  test("orders are closed the day after the close date", () => {
    expect(isOrderingClosed(new Date("2026-12-17T12:00:00Z"), "2026-12-16")).toBe(true);
  });

  test("the Trinidad calendar date decides, not UTC", () => {
    // 16 Dec, 11:59 pm in Trinidad (UTC-4) is still 16 Dec.
    expect(isOrderingClosed(new Date("2026-12-17T03:59:00Z"), "2026-12-16")).toBe(false);
    // 17 Dec, 12:00 am in Trinidad.
    expect(isOrderingClosed(new Date("2026-12-17T04:00:00Z"), "2026-12-16")).toBe(true);
  });
});

describe("isAfterLastFulfilment", () => {
  test("the last fulfilment date itself is allowed", () => {
    expect(isAfterLastFulfilment("2026-12-23", "2026-12-23")).toBe(false);
  });

  test("a date after the last fulfilment date is refused", () => {
    expect(isAfterLastFulfilment("2026-12-24", "2026-12-23")).toBe(true);
  });
});
