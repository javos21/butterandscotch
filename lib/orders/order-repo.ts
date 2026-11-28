import {
  DateUnavailableError,
  type InsertedOrder,
  type NewOrder,
  type NewOrderItem,
  type OrderRef,
  type OrderRepo,
} from "@/lib/orders/create-order";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Item, Settings } from "@/lib/types";

const UNIQUE_VIOLATION = "23505";
const DATE_UNAVAILABLE = "date_unavailable";

async function findOrderByKey(key: string): Promise<OrderRef | null> {
  const { data, error } = await createAdminSupabase()
    .from("orders")
    .select("id, order_number, access_token")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id, orderNumber: data.order_number, token: data.access_token };
}

/**
 * Production repository, on the service role. The order and its items are written in one
 * transaction by create_order_with_items, which also enforces blocked dates and the daily cap.
 */
export function buildOrderRepo(): OrderRepo {
  const db = createAdminSupabase();

  return {
    async getSettings() {
      const { data, error } = await db.from("settings").select("*").eq("id", 1).single();
      if (error) throw new Error(error.message);
      return data as unknown as Settings;
    },

    async getItems(ids: string[]) {
      const { data, error } = await db.from("items").select("*").in("id", ids);
      if (error) throw new Error(error.message);
      return (data ?? []) as Item[];
    },

    findByIdempotencyKey: findOrderByKey,

    async insertOrder(order: NewOrder, items: NewOrderItem[]): Promise<InsertedOrder> {
      const { data, error } = await db.rpc("create_order_with_items", {
        order_data: order,
        items,
      });

      if (error) {
        if (error.message === DATE_UNAVAILABLE) {
          // Two submits with the same key can both see the last slot taken: the winner's order
          // is then the answer, not a full date.
          const existing = await findOrderByKey(order.idempotency_key);
          if (existing) return { ...existing, created: false };
          throw new DateUnavailableError();
        }
        // A concurrent request with the same key won the race: return its order.
        if (error.code === UNIQUE_VIOLATION) {
          const existing = await findOrderByKey(order.idempotency_key);
          if (existing) return { ...existing, created: false };
        }
        throw new Error(error.message);
      }

      const row = data?.[0];
      if (!row) throw new Error("create_order_with_items returned no row");
      return {
        id: row.id,
        orderNumber: row.order_number,
        token: row.access_token,
        created: true,
      };
    },
  };
}
