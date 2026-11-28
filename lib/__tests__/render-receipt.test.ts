import { describe, expect, test, vi } from "vitest";
import { receiptFilename, renderReceiptPdf } from "@/lib/receipt/render-receipt";
import type { ReceiptData } from "@/lib/receipt/receipt-data";

// The module is server-only in the app. Tests run in node, so the guard is a no-op here.
vi.mock("server-only", () => ({}));

const data: ReceiptData = {
  orderNumber: "BS-0142",
  customerName: "Asha Mohan",
  paidOn: "2026-11-24",
  fulfilDate: "2026-11-28",
  fulfilment: "pickup",
  lines: [
    { name: "Red Velvet Cupcakes", flavour: null, quantity: 6, unitPriceCents: 1000, lineTotalCents: 6000 },
    { name: "Mini Cookie Bag", flavour: "Half & Half", quantity: 1, unitPriceCents: 1800, lineTotalCents: 1800 },
  ],
  adjustmentsCents: 0,
  totalCents: 7800,
  whatsappNumber: "+1 868 555 0100",
};

describe("renderReceiptPdf", () => {
  test("returns a PDF document", async () => {
    const pdf = await renderReceiptPdf(data);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  }, 30_000);
});

describe("renderReceiptPdf without the logo", () => {
  test("still returns a PDF when the logo path is missing", async () => {
    const pdf = await renderReceiptPdf(data, "/nonexistent/path/logo-red.png");
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  }, 30_000);
});

describe("receiptFilename", () => {
  test("names the receipt after the order number", () => {
    expect(receiptFilename("BS-0142")).toBe("Butter-and-Scotch-receipt-BS-0142.pdf");
  });
});
