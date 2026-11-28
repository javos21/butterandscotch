import { randomBytes } from "node:crypto";
import { BOOKING_HORIZON_DAYS, dayState, trinidadToday } from "@/lib/dates";
import { siteUrl } from "@/lib/email/layout";
import { sendTemplate } from "@/lib/email/send";
import type { EmailDeps } from "@/lib/email/types";
import { lineTotal, sumCents } from "@/lib/money";
import type { Item, Settings } from "@/lib/types";
import { checkoutIssueError, checkoutSchema, type CheckoutField } from "@/lib/validation";

export type OrderRef = { id: string; orderNumber: string; token: string };

/** `created` is false when a concurrent request won the idempotency race and its order was returned. */
export type InsertedOrder = OrderRef & { created: boolean };

export type NewOrder = {
  idempotency_key: string;
  access_token: string;
  customer_name: string;
  email: string;
  phone: string;
  fulfilment: "pickup" | "delivery";
  delivery_address: string | null;
  fulfil_date: string;
  allergies: string;
  notes: string | null;
  marketing_opt_in: boolean;
  subtotal_cents: number;
  total_cents: number;
  status: "awaiting_payment";
  payment_window_started_at: string;
  policy_version: number;
  policy_accepted_at: string;
};

export type NewOrderItem = {
  item_id: string | null;
  item_name: string;
  flavour: string | null;
  unit_label: string;
  unit_price_cents: number;
  quantity: number;
};

export type OrderRepo = {
  getSettings(): Promise<Settings>;
  getItems(ids: string[]): Promise<Item[]>;
  findByIdempotencyKey(key: string): Promise<OrderRef | null>;
  insertOrder(order: NewOrder, items: NewOrderItem[]): Promise<InsertedOrder>;
};

/** Raised by insertOrder when the database refuses the date: blocked, or already at the daily cap. */
export class DateUnavailableError extends Error {
  constructor() {
    super("date_unavailable");
    this.name = "DateUnavailableError";
  }
}

export type CreateOrderDeps = {
  repo: OrderRepo;
  email: EmailDeps;
  now?: () => Date;
  /** Production schedules email after the response; tests omit this and await delivery inline. */
  defer?: (task: () => Promise<void>) => void;
};

export type CreateOrderResult =
  | { token: string }
  | { error: string; field?: CheckoutField };

/** True for a real calendar date. Rejects "2026-02-30", which Date would silently roll over. */
function isCalendarDate(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Turns a checkout into a priced, stored order and sends the two emails.
 * Prices come from the database; anything the browser sends about prices is ignored.
 */
export async function createOrder(
  input: unknown,
  deps: CreateOrderDeps,
): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return (
      checkoutIssueError(parsed.error.issues) ?? {
        error: "Please check your details and try again.",
      }
    );
  }
  const checkout = parsed.data;

  const existing = await deps.repo.findByIdempotencyKey(checkout.idempotencyKey);
  if (existing) return { token: existing.token };

  const settings = await deps.repo.getSettings();
  if (!settings.store_open) {
    return { error: "We're not taking orders right now. Your cart is saved." };
  }

  const now = deps.now ? deps.now() : new Date();

  const leadMessage = `Please choose a date at least ${settings.lead_time_days} days from today.`;
  if (!isCalendarDate(checkout.date)) {
    return { field: "date", error: leadMessage };
  }
  const state = dayState(checkout.date, {
    today: trinidadToday(now),
    leadDays: settings.lead_time_days,
    unavailable: new Set<string>(),
  });
  if (state === "past" || state === "too_soon") {
    return { field: "date", error: leadMessage };
  }
  if (state === "beyond") {
    return {
      field: "date",
      error: `Please choose a date within the next ${BOOKING_HORIZON_DAYS} days.`,
    };
  }

  const itemList = await deps.repo.getItems([
    ...new Set(checkout.lines.map((line) => line.itemId)),
  ]);
  const itemById = new Map(itemList.map((item) => [item.id, item]));

  const lines: NewOrderItem[] = [];
  const quantityByItem = new Map<string, number>();

  for (const line of checkout.lines) {
    const item = itemById.get(line.itemId);
    if (!item || !item.active) {
      return {
        field: "lines",
        error: `${item?.name ?? "An item"} is no longer available. Remove it from your cart to continue.`,
      };
    }

    const flavourOk =
      item.flavours.length > 0
        ? line.flavour !== null && item.flavours.includes(line.flavour)
        : line.flavour === null;
    if (!flavourOk) {
      return { field: "lines", error: `Please choose a flavour for ${item.name}.` };
    }

    quantityByItem.set(item.id, (quantityByItem.get(item.id) ?? 0) + line.quantity);
    lines.push({
      item_id: item.id,
      item_name: item.name,
      flavour: line.flavour,
      unit_label: item.unit_label,
      unit_price_cents: item.price_cents,
      quantity: line.quantity,
    });
  }

  // The limit is per item across all its flavours, so it is checked on the summed quantity.
  for (const [itemId, quantity] of quantityByItem) {
    const item = itemById.get(itemId);
    if (item && quantity > item.max_qty) {
      return {
        field: "lines",
        error: `You can order up to ${item.max_qty} ${item.name} per order.`,
      };
    }
  }

  const subtotalCents = sumCents(
    lines.map((line) => lineTotal(line.unit_price_cents, line.quantity)),
  );

  const nowIso = now.toISOString();
  const fulfilment = {
    fulfilment: checkout.fulfilment.type,
    delivery_address: checkout.fulfilment.type === "delivery" ? checkout.fulfilment.address : null,
    status: "awaiting_payment" as const,
    payment_window_started_at: nowIso,
  };

  // Delivery is charged separately, on delivery, so the order total is items only.
  const totalCents = subtotalCents;
  const token = randomBytes(32).toString("base64url");

  let inserted: InsertedOrder;
  try {
    inserted = await deps.repo.insertOrder(
      {
        idempotency_key: checkout.idempotencyKey,
        access_token: token,
        customer_name: checkout.name,
        email: checkout.email,
        phone: checkout.phone,
        ...fulfilment,
        fulfil_date: checkout.date,
        allergies: checkout.allergies,
        notes: checkout.notes || null,
        marketing_opt_in: checkout.marketingOptIn,
        subtotal_cents: subtotalCents,
        total_cents: totalCents,
        policy_version: settings.policy_version,
        policy_accepted_at: nowIso,
      },
      lines,
    );
  } catch (err) {
    if (err instanceof DateUnavailableError) {
      return {
        field: "date",
        error: "Sorry — that date just filled up. Please pick another date.",
      };
    }
    throw err;
  }

  if (!inserted.created) return { token: inserted.token };

  const sendEmails = async () => {
    const sends: Promise<{ ok: boolean }>[] = [
      sendTemplate(deps.email, {
        orderId: inserted.id,
        template: "order_received",
        to: checkout.email,
        data: {
          orderNumber: inserted.orderNumber,
          token: inserted.token,
          customerName: checkout.name,
          items: lines.map((line) => ({
            name: line.item_name,
            flavour: line.flavour,
            quantity: line.quantity,
            lineTotalCents: lineTotal(line.unit_price_cents, line.quantity),
          })),
          fulfilment: checkout.fulfilment.type,
          subtotalCents,
          totalCents,
          bank: settings.bank_details,
        },
      }),
    ];

    if (settings.notify_email) {
      // The admin link is built inside the try: a missing NEXT_PUBLIC_SITE_URL skips only the
      // staff alert, and is logged. The customer's order still stands.
      try {
        sends.push(
          sendTemplate(deps.email, {
            orderId: inserted.id,
            template: "staff_new_order",
            to: settings.notify_email,
            data: {
              orderNumber: inserted.orderNumber,
              customerName: checkout.name,
              email: checkout.email,
              phone: checkout.phone,
              fulfilDate: checkout.date,
              totalCents,
              adminUrl: `${siteUrl()}/admin/orders/${inserted.id}`,
            },
          }),
        );
      } catch (err) {
        console.error("[orders] staff new-order email skipped", err);
      }
    }
    await Promise.all(sends);
  };

  if (deps.defer) deps.defer(sendEmails);
  else await sendEmails();

  return { token: inserted.token };
}
