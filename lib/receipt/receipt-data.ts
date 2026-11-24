import type { OrderStatus } from "@/lib/order-status";

/** Statuses in which a receipt exists: the payment has been confirmed. */
export const RECEIPT_STATUSES: readonly OrderStatus[] = ["confirmed", "ready", "completed"];

export function hasReceipt(status: OrderStatus): boolean {
  return RECEIPT_STATUSES.includes(status);
}

export type ReceiptData = {
  orderNumber: string;
  customerName: string;
  /** ISO "YYYY-MM-DD" date the payment was confirmed. */
  paidOn: string;
  /** ISO "YYYY-MM-DD" fulfilment date. */
  fulfilDate: string;
  fulfilment: "pickup" | "delivery";
  /** Delivery area name. Null for pickup. */
  areaName: string | null;
  lines: {
    name: string;
    flavour: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  /** Null for pickup. */
  deliveryFeeCents: number | null;
  adjustmentsCents: number;
  totalCents: number;
  whatsappNumber: string;
};

/** The order fields a receipt needs. Amounts are integer cents. */
export type ReceiptOrder = {
  orderNumber: string;
  customerName: string;
  fulfilDate: string;
  fulfilment: "pickup" | "delivery";
  areaName: string | null;
  deliveryFeeCents: number | null;
  adjustmentsCents: number;
  totalCents: number;
  items: {
    name: string;
    flavour: string | null;
    quantity: number;
    unitPriceCents: number;
  }[];
};

/** Shapes an order into receipt data. The total is the order's stored total, not a recomputed one. */
export function buildReceiptData(
  order: ReceiptOrder,
  paidOn: string,
  whatsappNumber: string,
): ReceiptData {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    paidOn,
    fulfilDate: order.fulfilDate,
    fulfilment: order.fulfilment,
    areaName: order.fulfilment === "delivery" ? order.areaName : null,
    lines: order.items.map((item) => ({
      name: item.name,
      flavour: item.flavour,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.unitPriceCents * item.quantity,
    })),
    deliveryFeeCents: order.fulfilment === "delivery" ? order.deliveryFeeCents : null,
    adjustmentsCents: order.adjustmentsCents,
    totalCents: order.totalCents,
    whatsappNumber,
  };
}

/** The download name, e.g. Butter-and-Scotch-receipt-BS-0142.pdf. */
export function receiptFilename(orderNumber: string): string {
  return `Butter-and-Scotch-receipt-${orderNumber}.pdf`;
}
