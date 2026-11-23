import "server-only";
import { getBankDetails, getPublicSettings } from "@/lib/data/settings";
import { paymentOpen, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { BankDetails } from "@/lib/types";

/** Statuses in which the pickup location and hours are shared with the customer. */
const PICKUP_INFO_STATUSES: readonly OrderStatus[] = ["confirmed", "ready", "completed"];

export type OrderViewItem = {
  name: string;
  flavour: string | null;
  quantity: number;
  unitLabel: string;
  lineTotalCents: number;
};

export type OrderViewPayment = {
  status: "submitted" | "confirmed" | "rejected";
  rejectReason: string | null;
  createdAt: string;
};

/**
 * What the customer's private order page may show. No email, phone or access token.
 * Amounts are integer cents.
 */
export type OrderView = {
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  customerName: string;
  createdAt: string;
  fulfilment: "pickup" | "delivery";
  areaName: string | null;
  address: string | null;
  /** ISO "YYYY-MM-DD". */
  fulfilDate: string;
  items: OrderViewItem[];
  subtotalCents: number;
  /** Null for pickup, and for a delivery area that is still waiting for a quote. */
  deliveryFeeCents: number | null;
  adjustmentsCents: number;
  totalCents: number;
  /** Bank details to pay into. Set only while the customer can still pay. */
  bank: BankDetails | null;
  canUploadProof: boolean;
  /** The most recent payment proof, or null if none was uploaded. */
  latestPayment: OrderViewPayment | null;
  /** Pickup location and hours. Set only for a pickup order that is confirmed, ready or completed. */
  pickupInfo: string | null;
  whatsappNumber: string;
};

/** The order behind a private access token, shaped for the customer page. Null if no order has it. */
export async function getOrderView(token: string): Promise<OrderView | null> {
  const { data, error } = await createAdminSupabase()
    .from("orders")
    .select("*, order_items(*), payments(*)")
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const status = data.status as OrderStatus;
  const fulfilment = data.fulfilment as OrderView["fulfilment"];
  const settings = await getPublicSettings();
  const canUploadProof = paymentOpen(status);
  const bank = canUploadProof ? await getBankDetails() : null;

  const latest =
    [...data.payments].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  return {
    orderNumber: data.order_number,
    status,
    statusLabel: STATUS_LABEL[status],
    customerName: data.customer_name,
    createdAt: data.created_at,
    fulfilment,
    areaName: data.delivery_area_name,
    address: data.delivery_address,
    fulfilDate: data.fulfil_date,
    // Sorted here, not in the query: an embed without an order is not guaranteed to stay stable.
    items: [...data.order_items]
      .sort(
        (a, b) =>
          a.item_name.localeCompare(b.item_name) ||
          (a.flavour ?? "").localeCompare(b.flavour ?? "") ||
          a.id.localeCompare(b.id),
      )
      .map((item) => ({
      name: item.item_name,
      flavour: item.flavour,
      quantity: item.quantity,
      unitLabel: item.unit_label,
      lineTotalCents: item.unit_price_cents * item.quantity,
    })),
    subtotalCents: data.subtotal_cents,
    deliveryFeeCents: data.delivery_fee_cents,
    adjustmentsCents: data.adjustments_cents,
    totalCents: data.total_cents,
    bank,
    canUploadProof,
    latestPayment: latest
      ? {
          status: latest.status as OrderViewPayment["status"],
          rejectReason: latest.reject_reason,
          createdAt: latest.created_at,
        }
      : null,
    pickupInfo:
      fulfilment === "pickup" && PICKUP_INFO_STATUSES.includes(status)
        ? settings.pickup_info
        : null,
    whatsappNumber: settings.whatsapp_number,
  };
}
