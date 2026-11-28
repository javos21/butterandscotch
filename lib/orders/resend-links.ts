import { z } from "zod";
import { sendTemplate, type EmailDeps } from "@/lib/email/send";
import { normaliseEmail } from "@/lib/customers/normalise-email";
import { FIND_ORDER_RESPONSE } from "@/lib/orders/find-order-response";

export type ResendOrder = {
  orderNumber: string;
  token: string;
  customerName: string;
  fulfilDate: string;
};

export type ResendLinksDeps = {
  repo: {
    /** Non-cancelled orders for the email, most recent first. */
    findOrdersByEmail(email: string): Promise<ResendOrder[]>;
  };
  email: EmailDeps;
};

const emailSchema = z.email();

/**
 * Emails a customer the private links to their orders.
 * Always returns FIND_ORDER_RESPONSE, whether or not the email has orders, so the response never
 * reveals which addresses have ordered. Sends one order_links email when orders exist.
 */
export async function resendOrderLinks(
  email: string,
  deps: ResendLinksDeps,
): Promise<typeof FIND_ORDER_RESPONSE> {
  const normalised = normaliseEmail(email);
  if (!emailSchema.safeParse(normalised).success) return FIND_ORDER_RESPONSE;

  const orders = await deps.repo.findOrdersByEmail(normalised);
  if (orders.length === 0) return FIND_ORDER_RESPONSE;

  await sendTemplate(deps.email, {
    orderId: null,
    template: "order_links",
    to: normalised,
    data: {
      customerName: orders[0].customerName,
      orders: orders.map((order) => ({
        orderNumber: order.orderNumber,
        token: order.token,
        fulfilDate: order.fulfilDate,
      })),
    },
  });

  return FIND_ORDER_RESPONSE;
}
