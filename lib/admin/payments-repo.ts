import "server-only";
import { getPublicSettings } from "@/lib/data/settings";
import type {
  PaymentExpect,
  PaymentRecord,
  PaymentReview,
  PaymentReviewRepo,
  PaymentStatus,
  ReviewOrder,
} from "@/lib/admin/verify-payment";
import type { Json } from "@/lib/database.types";
import type { OrderStatus } from "@/lib/order-status";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Loads one order with its items, on the service role. Does no authorisation itself: callers must
 * have checked the lookup (requireStaff(), or a customer's access token). Shared with lib/receipt.
 */
export async function fetchOrder(column: "id" | "access_token", value: string): Promise<ReviewOrder | null> {
  const { data, error } = await createAdminSupabase()
    .from("orders")
    .select("*, order_items(*)")
    .eq(column, value)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    orderNumber: data.order_number,
    accessToken: data.access_token,
    customerName: data.customer_name,
    email: data.email,
    status: data.status as OrderStatus,
    fulfilment: data.fulfilment as "pickup" | "delivery",
    fulfilDate: data.fulfil_date,
    areaName: data.delivery_area_name,
    deliveryFeeCents: data.delivery_fee_cents,
    adjustmentsCents: data.adjustments_cents,
    totalCents: data.total_cents,
    items: [...data.order_items]
      .sort((a, b) => a.item_name.localeCompare(b.item_name) || a.id.localeCompare(b.id))
      .map((item) => ({
        name: item.item_name,
        flavour: item.flavour,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
      })),
  };
}

/**
 * Staff-facing proof review persistence, on the service role. Callers must run requireStaff() first.
 * Every write is conditional on the values read earlier.
 */
export function paymentReviewRepo(): PaymentReviewRepo {
  const db = createAdminSupabase();

  return {
    async findPayment(paymentId): Promise<PaymentRecord | null> {
      const { data, error } = await db
        .from("payments")
        .select("id, order_id, status, reference, receipt_path")
        .eq("id", paymentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.id,
        orderId: data.order_id,
        status: data.status as PaymentStatus,
        reference: data.reference,
        receiptPath: data.receipt_path,
      };
    },

    async updatePayment(paymentId: string, expect: PaymentExpect, set: PaymentReview) {
      // Every guard must still match: a second review, or a re-upload that changed the proof, is a no-op.
      let builder = db
        .from("payments")
        .update({
          status: set.status,
          reviewed_by: set.reviewedBy,
          reviewed_at: set.reviewedAt,
          reject_reason: set.rejectReason,
        })
        .eq("id", paymentId)
        .eq("status", expect.status);
      builder =
        expect.reference === null ? builder.is("reference", null) : builder.eq("reference", expect.reference);
      builder =
        expect.receiptPath === null
          ? builder.is("receipt_path", null)
          : builder.eq("receipt_path", expect.receiptPath);
      const { data, error } = await builder.select("id");
      if (error) throw new Error(error.message);
      return data.length === 1;
    },

    findOrder(orderId) {
      return fetchOrder("id", orderId);
    },

    async moveOrder(orderId, from, to, windowStart) {
      const patch =
        windowStart === null
          ? { status: to }
          : { status: to, payment_window_started_at: windowStart, reminder_sent_at: null };
      const { data, error } = await db
        .from("orders")
        .update(patch)
        .eq("id", orderId)
        .eq("status", from)
        .select("id");
      if (error) throw new Error(error.message);
      return data.length === 1;
    },

    async addEvent(orderId, kind, detail, staffId) {
      const { error } = await db.from("order_events").insert({
        order_id: orderId,
        kind,
        detail: detail as NonNullable<Json>,
        staff_id: staffId,
      });
      if (error) throw new Error(error.message);
    },

    async getWhatsappNumber() {
      return (await getPublicSettings()).whatsapp_number;
    },
  };
}

