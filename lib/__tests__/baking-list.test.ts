import { describe, expect, test } from "vitest";
import { buildBakingDays, type BoardOrder } from "@/lib/admin/baking-list";

function order(partial: Partial<BoardOrder> & Pick<BoardOrder, "id">): BoardOrder {
  return {
    orderNumber: `BS-${partial.id}`,
    customerName: "Asha",
    status: "confirmed",
    fulfilDate: "2026-11-24",
    fulfilment: "pickup",
    items: [],
    ...partial,
  };
}

describe("buildBakingDays", () => {
  test("returns one entry per date including empty days", () => {
    const days = buildBakingDays([], "2026-11-24", 7);
    expect(days.map((d) => d.date)).toEqual([
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
    ]);
    for (const day of days) {
      expect(day.orders).toEqual([]);
      expect(day.totals).toEqual([]);
    }
  });

  test("excludes cancelled orders from orders and totals", () => {
    const days = buildBakingDays(
      [
        order({
          id: "1",
          status: "cancelled",
          items: [
            { name: "Mini Cookie Bag", flavour: "Coconut", quantity: 5, unitLabel: "bag", nuts: false },
          ],
        }),
      ],
      "2026-11-24",
      2,
    );
    expect(days[0].orders).toEqual([]);
    expect(days[0].totals).toEqual([]);
  });

  test("groups totals by item with a flavour breakdown", () => {
    const days = buildBakingDays(
      [
        order({
          id: "1",
          items: [
            { name: "Mini Cookie Bag", flavour: "Half & Half", quantity: 2, unitLabel: "bag", nuts: false },
            { name: "Mini Cookie Bag", flavour: "Coconut", quantity: 1, unitLabel: "bag", nuts: false },
          ],
        }),
      ],
      "2026-11-24",
      1,
    );
    expect(days[0].orders).toHaveLength(1);
    expect(days[0].totals).toEqual([
      {
        name: "Mini Cookie Bag",
        unitLabel: "bag",
        quantity: 3,
        nuts: false,
        flavours: [
          { flavour: "Coconut", quantity: 1 },
          { flavour: "Half & Half", quantity: 2 },
        ],
      },
    ]);
  });

  test("carries the nuts flag and sorts totals by name", () => {
    const days = buildBakingDays(
      [
        order({
          id: "1",
          items: [
            { name: "Pecan Brittle", flavour: null, quantity: 1, unitLabel: "tin", nuts: true },
            { name: "Almond Cake", flavour: null, quantity: 2, unitLabel: "slice", nuts: false },
          ],
        }),
      ],
      "2026-11-24",
      1,
    );
    expect(days[0].totals.map((t) => t.name)).toEqual(["Almond Cake", "Pecan Brittle"]);
    expect(days[0].totals[1].nuts).toBe(true);
    expect(days[0].totals[0].nuts).toBe(false);
  });

  test("places each order on its own fulfil date only", () => {
    const days = buildBakingDays(
      [
        order({ id: "1", fulfilDate: "2026-11-24" }),
        order({ id: "2", fulfilDate: "2026-11-26" }),
        order({ id: "3", fulfilDate: "2026-12-30" }),
      ],
      "2026-11-24",
      3,
    );
    expect(days.map((d) => d.orders.map((o) => o.id))).toEqual([["1"], [], ["2"]]);
  });
});
