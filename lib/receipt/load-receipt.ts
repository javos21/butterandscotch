import "server-only";
import { fetchOrder } from "@/lib/admin/payments-repo";
import { getPublicSettings } from "@/lib/data/settings";
import { trinidadToday } from "@/lib/dates";
import { buildReceiptData, hasReceipt, type ReceiptData } from "@/lib/receipt/receipt-data";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * The receipt data for a confirmed, ready or completed order, or null when the order is missing or has
 * no confirmed payment yet. Two callers use it: the customer route (found by access token) and the staff
 * route (found by order id). Authorisation is the caller's job: the access token is the customer's
 * credential, and the staff route must call requireStaff() first.
 */
export async function loadReceiptData(lookup: { token: string } | { orderId: string }): Promise<ReceiptData | null> {
  const order =
    "token" in lookup
      ? await fetchOrder("access_token", lookup.token)
      : await fetchOrder("id", lookup.orderId);
  if (!order || !hasReceipt(order.status)) return null;

  const { data, error } = await createAdminSupabase()
    .from("payments")
    .select("reviewed_at")
    .eq("order_id", order.id)
    .eq("status", "confirmed")
    .order("reviewed_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);

  const reviewedAt = data[0]?.reviewed_at ?? null;
  const paidOn = trinidadToday(reviewedAt ? new Date(reviewedAt) : new Date());
  const settings = await getPublicSettings();
  return buildReceiptData(order, paidOn, settings.whatsapp_number);
}
