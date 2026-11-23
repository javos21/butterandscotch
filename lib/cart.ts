/**
 * The bag: a pure reducer plus localStorage persistence. No React in here, so it can be
 * tested directly. Prices are copied in at add time for display only; the server reprices
 * every line at checkout.
 */
import { z } from "zod";
import { randomId } from "@/lib/uuid";

export type CartLine = {
  lineId: string;
  itemId: string;
  name: string;
  /** The chosen flavour, or null for items that have none. */
  flavour: string | null;
  unitLabel: string;
  unitPriceCents: number;
  quantity: number;
  /** The most of this item one customer may order, across all flavours. */
  maxQty: number;
};

export type CartAction =
  | { type: "add"; line: Omit<CartLine, "lineId"> }
  | { type: "setQuantity"; lineId: string; quantity: number }
  | { type: "remove"; lineId: string }
  | { type: "clear" };

export const CART_STORAGE_KEY = "bs-cart-v1";

/** How many of one item are in the bag, across every flavour. */
export function itemQuantity(lines: CartLine[], itemId: string): number {
  return lines.reduce((total, line) => (line.itemId === itemId ? total + line.quantity : total), 0);
}

/** How many more of an item the customer may add before reaching maxQty. */
export function roomFor(lines: CartLine[], itemId: string, maxQty: number): number {
  return Math.max(0, maxQty - itemQuantity(lines, itemId));
}

/** Total of all lines in cents. */
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.unitPriceCents * line.quantity, 0);
}

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add": {
      const { line } = action;
      const quantity = Math.min(line.quantity, roomFor(state, line.itemId, line.maxQty));
      if (quantity <= 0) return state;

      const existing = state.find((l) => l.itemId === line.itemId && l.flavour === line.flavour);
      if (existing) {
        return state.map((l) =>
          l.lineId === existing.lineId ? { ...l, quantity: l.quantity + quantity, maxQty: line.maxQty } : l,
        );
      }
      return [...state, { ...line, quantity, lineId: randomId() }];
    }
    case "setQuantity": {
      const target = state.find((l) => l.lineId === action.lineId);
      if (!target) return state;

      const othersOfItem = itemQuantity(state, target.itemId) - target.quantity;
      const quantity = Math.max(0, Math.min(action.quantity, target.maxQty - othersOfItem));
      if (quantity === 0) return state.filter((l) => l.lineId !== action.lineId);
      return state.map((l) => (l.lineId === action.lineId ? { ...l, quantity } : l));
    }
    case "remove":
      return state.filter((line) => line.lineId !== action.lineId);
    case "clear":
      return [];
  }
}

/** Every field a stored line must have to be rendered and totalled safely. */
const storedCartLineSchema = z.object({
  lineId: z.string(),
  itemId: z.string(),
  name: z.string(),
  flavour: z.string().nullable(),
  unitLabel: z.string(),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  maxQty: z.number().int().positive(),
});

/** The saved bag, or [] if nothing is saved, the value is not an array, or storage is unavailable. Invalid lines are dropped. */
export function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const result = storedCartLineSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

/** Persists the bag. Storage failures (private mode, quota) are ignored; the bag stays in memory. */
export function saveCart(lines: CartLine[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage unavailable: nothing to do.
  }
}
