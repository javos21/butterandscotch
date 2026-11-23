import { describe, expect, test } from "vitest";
import { normalisePhone, waLink } from "@/lib/phone";

describe("normalisePhone", () => {
  test("formats Trinidad numbers in every common style", () => {
    for (const raw of ["1234567", "868 123 4567", "+1 (868) 123-4567", "18681234567", "+1-868-123-4567"])
      expect(normalisePhone(raw)).toBe("+1-868-123-4567");
  });

  test("keeps international numbers with a plus sign", () => {
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
  });

  test("returns null when there is no usable number", () => {
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("call me")).toBeNull();
  });
});

describe("waLink", () => {
  test("builds a wa.me link with an optional prefilled message", () => {
    expect(waLink("+1-868-123-4567", "Order BS-0001")).toBe("https://wa.me/18681234567?text=Order%20BS-0001");
  });

  test("omits the text parameter when no message is given", () => {
    expect(waLink("+1-868-123-4567")).toBe("https://wa.me/18681234567");
  });

  test("returns null for an unusable number", () => {
    expect(waLink("call me")).toBeNull();
  });
});
