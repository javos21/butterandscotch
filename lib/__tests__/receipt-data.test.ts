import { describe, expect, test } from "vitest";
import { buildReceiptData, type ReceiptOrder } from "@/lib/receipt/receipt-data";

const delivery: ReceiptOrder = {
  orderNumber: "BS-0142",
  customerName: "Asha Mohan",
  fulfilDate: "2026-11-28",
  fulfilment: "delivery",
  areaName: "Port of Spain",
  deliveryFeeCents: 3000,
  adjustmentsCents: 0,
  totalCents: 9800,
  items: [
    { name: "Red Velvet Cupcakes", flavour: null, quantity: 2, unitPriceCents: 2500 },
    { name: "Mini Cookie Bag", flavour: "Half & Half", quantity: 1, unitPriceCents: 1800 },
  ],
};

describe("buildReceiptData", () => {
  test("two lines and a delivery fee: the total echoes the order total", () => {
    const data = buildReceiptData(delivery, "2026-11-24", "+1 868 555 0100");
    expect(data.totalCents).toBe(9800);
    expect(data.deliveryFeeCents).toBe(3000);
    expect(data.lines).toHaveLength(2);
    expect(data.paidOn).toBe("2026-11-24");
    expect(data.whatsappNumber).toBe("+1 868 555 0100");
  });

  test("each line total is unit price times quantity", () => {
    const data = buildReceiptData(delivery, "2026-11-24", "");
    expect(data.lines.map((line) => line.lineTotalCents)).toEqual([5000, 1800]);
    expect(data.lines[1]).toMatchObject({ name: "Mini Cookie Bag", flavour: "Half & Half", quantity: 1 });
  });

  test("a pickup order has no area name even when the order stores one", () => {
    const data = buildReceiptData(
      { ...delivery, fulfilment: "pickup", areaName: "Port of Spain", deliveryFeeCents: null },
      "2026-11-24",
      "",
    );
    expect(data.areaName).toBeNull();
    expect(data.fulfilment).toBe("pickup");
    expect(data.deliveryFeeCents).toBeNull();
  });
});
