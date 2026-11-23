import { describe, expect, test, vi, afterEach } from "vitest";
import { cartReducer, cartSubtotal, itemQuantity, loadCart, roomFor, CART_STORAGE_KEY } from "@/lib/cart";

const bag = { itemId: "bag", name: "Mini Cookie Bag", unitLabel: "each", unitPriceCents: 5000, maxQty: 10 };

describe("cartReducer", () => {
  test("merges same item and flavour, clamps across flavours, and removes on zero", () => {
    let s = cartReducer([], { type: "add", line: { ...bag, flavour: "Coconut Butterscotch", quantity: 2 } });
    s = cartReducer(s, { type: "add", line: { ...bag, flavour: "Coconut Butterscotch", quantity: 1 } });
    expect(s).toHaveLength(1);
    expect(s[0].quantity).toBe(3);
    s = cartReducer(s, { type: "add", line: { ...bag, flavour: "Half & Half", quantity: 9 } });
    expect(itemQuantity(s, "bag")).toBe(10); // clamped across flavours
    expect(roomFor(s, "bag", 10)).toBe(0);
    expect(cartSubtotal(s)).toBe(50000);
    s = cartReducer(s, { type: "setQuantity", lineId: s[0].lineId, quantity: 0 });
    expect(s).toHaveLength(1);
  });
});

describe("loadCart", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("drops stored entries that are not valid lines", () => {
    const stored = [
      { lineId: "a", itemId: "bag", name: "Bag", flavour: null, unitLabel: "each", unitPriceCents: 5000, quantity: 1, maxQty: 10 },
      { lineId: "b", itemId: 42 },
    ];
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === CART_STORAGE_KEY ? JSON.stringify(stored) : null) });
    expect(loadCart()).toHaveLength(1);
  });

  test("returns an empty bag when storage is unavailable or holds garbage", () => {
    expect(loadCart()).toEqual([]);
    vi.stubGlobal("localStorage", { getItem: () => "{not json" });
    expect(loadCart()).toEqual([]);
  });
});
