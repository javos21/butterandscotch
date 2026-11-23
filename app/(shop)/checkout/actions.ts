"use server";

import { after } from "next/server";
import { defaultEmailDeps } from "@/lib/email/deps";
import { createOrder, type CreateOrderResult } from "@/lib/orders/create-order";
import { buildOrderRepo } from "@/lib/orders/order-repo";

/**
 * Checkout entry point. Validates the bag, prices it from the database, and creates the order.
 * Emails go out after the response. Only async functions may be exported from a "use server" file.
 */
export async function placeOrderAction(input: unknown): Promise<CreateOrderResult> {
  try {
    return await createOrder(input, {
      repo: buildOrderRepo(),
      email: defaultEmailDeps(),
      defer: (task) => after(task),
    });
  } catch (err) {
    console.error("[checkout] placeOrderAction failed", err);
    return {
      error: "We couldn’t place your order. Please try again — your details are still here.",
    };
  }
}
