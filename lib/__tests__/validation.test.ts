import { describe, expect, test } from "vitest";
import { checkoutFieldError, checkoutSchema } from "@/lib/validation";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";

const ok = {
  name: "Ana",
  email: "Ana@Example.com",
  phone: "868 123 4567",
  fulfilment: { type: "pickup", location: "West" },
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
    expect(parsed.broadcastOptIn).toBe(false);
  });

  test("rejects blank allergies", () => {
    expect(checkoutSchema.safeParse({ ...ok, allergies: "  " }).success).toBe(false);
  });

  test("rejects when the policy is not accepted", () => {
    expect(checkoutSchema.safeParse({ ...ok, acceptPolicy: false }).success).toBe(false);
  });

  test("rejects delivery without an address", () => {
    expect(
      checkoutSchema.safeParse({ ...ok, fulfilment: { type: "delivery", address: "" } }).success,
    ).toBe(false);
  });

  test("pickup without a location is refused with the location message", () => {
    expect(checkoutFieldError({ ...ok, fulfilment: { type: "pickup", location: "" } })).toEqual({
      field: "pickupLocation",
      error: "Choose West or Chaguanas",
    });
    expect(checkoutFieldError({ ...ok, fulfilment: { type: "pickup" } })).toEqual({
      field: "pickupLocation",
      error: "Choose West or Chaguanas",
    });
  });

  test("pickup accepts West and Chaguanas and no other location", () => {
    expect(checkoutSchema.safeParse({ ...ok, fulfilment: { type: "pickup", location: "Chaguanas" } }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...ok, fulfilment: { type: "pickup", location: "Arima" } }).success).toBe(false);
  });

  test("delivery without an address is refused against the address field", () => {
    expect(checkoutFieldError({ ...ok, fulfilment: { type: "delivery", address: "" } })).toEqual({
      field: "address",
      error: "Please enter your delivery address.",
    });
  });

  test("notes in the input are ignored and not returned", () => {
    const parsed = checkoutSchema.parse({ ...ok, notes: "Please ring twice" });
    expect(parsed).not.toHaveProperty("notes");
  });

  test("accepts delivery with an address and no area", () => {
    expect(
      checkoutSchema.safeParse({
        ...ok,
        fulfilment: { type: "delivery", address: "12 Main Road, St Ann's" },
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
