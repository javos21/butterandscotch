import { describe, expect, test } from "vitest";
import { buildReceiptData, type ReceiptOrder } from "@/lib/receipt/receipt-data";

const delivery: ReceiptOrder = {
  orderNumber: "BS-0142",
  customerName: "Asha Mohan",
  fulfilDate: "2026-11-28",
  fulfilment: "delivery",
  adjustmentsCents: 0,
  totalCents: 9800,
  items: [
    { name: "Red Velvet Cupcakes", flavour: null, quantity: 2, unitPriceCents: 2500 },
    { name: "Mini Cookie Bag", flavour: "Half & Half", quantity: 1, unitPriceCents: 1800 },
  ],
};

describe("buildReceiptData", () => {
  test("two lines: the total echoes the order total, with no delivery fee line", () => {
    const data = buildReceiptData(delivery, "2026-11-24", "+1 868 555 0100");
    expect(data.totalCents).toBe(9800);
    expect(data).not.toHaveProperty("deliveryFeeCents");
    expect(data.lines).toHaveLength(2);
    expect(data.paidOn).toBe("2026-11-24");
    expect(data.whatsappNumber).toBe("+1 868 555 0100");
  });

  test("each line total is unit price times quantity", () => {
    const data = buildReceiptData(delivery, "2026-11-24", "");
    expect(data.lines.map((line) => line.lineTotalCents)).toEqual([5000, 1800]);
    expect(data.lines[1]).toMatchObject({ name: "Mini Cookie Bag", flavour: "Half & Half", quantity: 1 });
  });

  test("a pickup order stays a pickup and carries no delivery fee", () => {
    const data = buildReceiptData({ ...delivery, fulfilment: "pickup" }, "2026-11-24", "");
    expect(data.fulfilment).toBe("pickup");
    expect(data).not.toHaveProperty("deliveryFeeCents");
    expect(data).not.toHaveProperty("areaName");
  });
});
