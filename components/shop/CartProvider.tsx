"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  cartReducer,
  cartSubtotal,
  loadCart,
  saveCart,
  type CartAction,
  type CartLine,
} from "@/lib/cart";

type CartContextValue = {
  lines: CartLine[];
  /** Units in the bag across all lines. */
  count: number;
  subtotalCents: number;
  add: (line: Omit<CartLine, "lineId">) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
};

/*
 * The bag is a small external store. It loads from localStorage on the first client read.
 * During hydration React uses the empty server snapshot, so the markup matches the server.
 * Writes go through dispatch, which saves to localStorage on every change.
 */
const EMPTY_BAG: CartLine[] = [];
let bag: CartLine[] | null = null;
const listeners = new Set<() => void>();

function getBag(): CartLine[] {
  if (bag === null) bag = loadCart();
  return bag;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dispatch(action: CartAction) {
  bag = cartReducer(getBag(), action);
  saveCart(bag);
  listeners.forEach((listener) => listener());
}

const add = (line: Omit<CartLine, "lineId">) => dispatch({ type: "add", line });
const setQuantity = (lineId: string, quantity: number) =>
  dispatch({ type: "setQuantity", lineId, quantity });
const remove = (lineId: string) => dispatch({ type: "remove", lineId });
const clear = () => dispatch({ type: "clear" });

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getBag, () => EMPTY_BAG);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((total, line) => total + line.quantity, 0),
      subtotalCents: cartSubtotal(lines),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
