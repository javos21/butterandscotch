import { describe, expect, test } from "vitest";
import { checkoutSchema } from "@/lib/validation";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";

const ok = {
  name: "Ana",
  email: "Ana@Example.com",
  phone: "868 123 4567",
  fulfilment: { type: "pickup" },
  date: "2026-12-20",
  allergies: "None",
  acceptPolicy: true,
  idempotencyKey: "k".repeat(20),
  lines: [{ itemId: ITEM_ID, flavour: null, quantity: 1 }],
};

describe("checkoutSchema", () => {
  test("accepts a valid pickup checkout and normalises email and phone", () => {
    const parsed = checkoutSchema.parse(ok);
    expect(parsed.email).toBe("ana@example.com");
    expect(parsed.phone).toBe("+1-868-123-4567");
    expect(parsed.marketingOptIn).toBe(false);
  });

  test("rejects blank allergies", () => {
    expect(checkoutSchema.safeParse({ ...ok, allergies: "  " }).success).toBe(false);
  });

  test("rejects when the policy is not accepted", () => {
    expect(checkoutSchema.safeParse({ ...ok, acceptPolicy: false }).success).toBe(false);
  });

  test("rejects delivery without an address", () => {
    expect(
      checkoutSchema.safeParse({ ...ok, fulfilment: { type: "delivery", areaId: ITEM_ID, address: "" } }).success,
    ).toBe(false);
  });

  test("accepts delivery with an area and address", () => {
    expect(
      checkoutSchema.safeParse({
        ...ok,
        fulfilment: { type: "delivery", areaId: ITEM_ID, address: "12 Main Road, St Ann's" },
      }).success,
    ).toBe(true);
  });

  test("rejects an invalid phone with the WhatsApp message", () => {
    const result = checkoutSchema.safeParse({ ...ok, phone: "12345" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Please enter a valid WhatsApp number");
    }
  });

  test("rejects an empty or oversized order", () => {
    expect(checkoutSchema.safeParse({ ...ok, lines: [] }).success).toBe(false);
    const tooMany = Array.from({ length: 31 }, () => ({ itemId: ITEM_ID, flavour: null, quantity: 1 }));
    expect(checkoutSchema.safeParse({ ...ok, lines: tooMany }).success).toBe(false);
  });

  test("rejects a quantity outside 1 to 100 and a malformed date", () => {
    expect(checkoutSchema.safeParse({ ...ok, lines: [{ itemId: ITEM_ID, flavour: null, quantity: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, lines: [{ itemId: ITEM_ID, flavour: null, quantity: 101 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, date: "20-12-2026" }).success).toBe(false);
  });
});
