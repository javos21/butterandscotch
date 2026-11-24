import "server-only";
import type { AdminOrder, AdminOrderRepo, OrderUpdate } from "@/lib/admin/order-actions";
import type { Json } from "@/lib/database.types";
import type { OrderStatus } from "@/lib/order-status";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { createServerSupabase } from "@/lib/supabase/server";

type StaffClient = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Staff order persistence. Reads and conditional writes use the service role; the fulfil date RPC
 * uses the signed-in staff client so is_staff() sees the user. Callers must run requireStaff() first.
 */
export function adminOrderRepo(staffDb: StaffClient): AdminOrderRepo {
  const db = createAdminSupabase();

  return {
    async findOrder(orderId): Promise<AdminOrder | null> {
      const { data, error } = await db
        .from("orders")
        .select(
          "id, order_number, access_token, customer_name, email, status, fulfilment, fulfil_date, subtotal_cents, adjustments_cents, delivery_fee_cents, total_cents",
        )
        .eq("id", orderId)
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
        subtotalCents: data.subtotal_cents,
        adjustmentsCents: data.adjustments_cents,
        deliveryFeeCents: data.delivery_fee_cents,
        totalCents: data.total_cents,
      };
    },

    async updateOrder(orderId: string, expectStatus: OrderStatus, set: OrderUpdate) {
      const patch = {
        status: set.status,
        ...(set.deliveryFeeCents !== undefined ? { delivery_fee_cents: set.deliveryFeeCents } : {}),
        ...(set.totalCents !== undefined ? { total_cents: set.totalCents } : {}),
        ...(set.paymentWindowStartedAt !== undefined
          ? { payment_window_started_at: set.paymentWindowStartedAt, reminder_sent_at: null }
          : {}),
      };
      const { data, error } = await db
        .from("orders")
        .update(patch)
        .eq("id", orderId)
        .eq("status", expectStatus)
        .select("id");
      if (error) throw new Error(error.message);
      return data.length === 1;
    },

    async changeFulfilDate(orderId, newDate, overrideCap) {
      const { data, error } = await staffDb.rpc("staff_change_fulfil_date", {
        p_order_id: orderId,
        p_new_date: newDate,
        p_override_cap: overrideCap,
      });
      if (error) throw new Error(error.message);
      return data;
    },

    async hasSubmittedPayment(orderId) {
      const { data, error } = await db
        .from("payments")
        .select("id")
        .eq("order_id", orderId)
        .eq("status", "submitted")
        .limit(1);
      if (error) throw new Error(error.message);
      return data.length > 0;
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
  };
}
