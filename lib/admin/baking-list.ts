import { addDays } from "@/lib/dates";
import type { OrderStatus } from "@/lib/order-status";

/** Shown for items that have no flavour, so every quantity sits under a label. */
const NO_FLAVOUR = "No flavour";

export type BoardItem = {
  name: string;
  flavour: string | null;
  quantity: number;
  unitLabel: string;
  /** True when the menu item carries an allergen note about nuts. */
  nuts: boolean;
};

export type BoardOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  /** ISO "YYYY-MM-DD". */
  fulfilDate: string;
  fulfilment: "pickup" | "delivery";
  items: BoardItem[];
};

export type BakingTotal = {
  name: string;
  unitLabel: string;
  quantity: number;
  nuts: boolean;
  flavours: { flavour: string; quantity: number }[];
};

export type BakingDay = {
  date: string;
  orders: BoardOrder[];
  totals: BakingTotal[];
};

/**
 * Groups orders into one entry per calendar day, starting at fromDate, for `days` days.
 * Days with no orders are still returned. Cancelled orders are left out of both the order list and the totals.
 * Totals are per item name, sorted by name, with a per-flavour breakdown.
 */
export function buildBakingDays(
  orders: BoardOrder[],
  fromDate: string,
  days: number,
): BakingDay[] {
  const active = orders.filter((order) => order.status !== "cancelled");
  return Array.from({ length: days }, (_, offset) => {
    const date = addDays(fromDate, offset);
    const dayOrders = active.filter((order) => order.fulfilDate === date);
    return { date, orders: dayOrders, totals: totalsFor(dayOrders) };
  });
}

function totalsFor(orders: BoardOrder[]): BakingTotal[] {
  const byName = new Map<
    string,
    { unitLabel: string; quantity: number; nuts: boolean; flavours: Map<string, number> }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      let entry = byName.get(item.name);
      if (!entry) {
        entry = { unitLabel: item.unitLabel, quantity: 0, nuts: false, flavours: new Map() };
        byName.set(item.name, entry);
      }
      const flavour = item.flavour ?? NO_FLAVOUR;
      entry.quantity += item.quantity;
      entry.nuts = entry.nuts || item.nuts;
      entry.flavours.set(flavour, (entry.flavours.get(flavour) ?? 0) + item.quantity);
    }
  }

  return [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entry]) => ({
      name,
      unitLabel: entry.unitLabel,
      quantity: entry.quantity,
      nuts: entry.nuts,
      flavours: [...entry.flavours.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([flavour, quantity]) => ({ flavour, quantity })),
    }));
}
