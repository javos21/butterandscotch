import "server-only";
import { getAdminCounts } from "@/lib/admin/counts";
import { lastDayOfMonth } from "@/lib/admin/home-calendar";
import type { OrderStatus } from "@/lib/order-status";
import { createAdminSupabase } from "@/lib/supabase/admin";

/*
 * Read-only queries for the admin pages. Service role. Callers must run requireStaff() first.
 */

const PAGE_SIZE = 25;
const RECEIPT_URL_SECONDS = 600;

/** Escapes LIKE wildcards so the search term matches literally in ilike. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Strips characters that could close or add a filter inside an .or() expression.
 * Commas and parentheses are the only ones that matter there.
 */
function cleanSearch(q: string | undefined): string {
  return (q ?? "").replace(/[,()]/g, "").trim();
}

/**
 * Signed URL for one receipt file. Null when there is no file or it cannot be signed, so a bad file
 * shows as "No file" instead of breaking the page.
 */
async function signedReceiptUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await createAdminSupabase()
      .storage.from("receipts")
      .createSignedUrl(path, RECEIPT_URL_SECONDS);
    if (error || !data) {
      console.error("[queries] receipt URL failed", path, error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error("[queries] receipt URL threw", path, err);
    return null;
  }
}

/** Signed URLs for many receipt files in one request. A path that cannot be signed is left out of the map. */
async function signedReceiptUrls(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  try {
    const { data, error } = await createAdminSupabase()
      .storage.from("receipts")
      .createSignedUrls(paths, RECEIPT_URL_SECONDS);
    if (error || !data) {
      console.error("[queries] receipt URLs failed", error?.message);
      return urls;
    }
    for (const item of data) {
      if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
    }
  } catch (err) {
    console.error("[queries] receipt URLs threw", err);
  }
  return urls;
}

// Home ----------------------------------------------------------------------

export type HomeTiles = {
  /** Proofs waiting for staff to check. */
  proofsToCheck: number;
  /** Orders baked and ready, waiting to be marked complete. */
  readyToComplete: number;
  /** Live orders due today. */
  ordersToday: number;
};

export type HomeOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  fulfilment: "pickup" | "delivery";
  items: { name: string; flavour: string | null; quantity: number; unitLabel: string }[];
};

export type HomeData = {
  tiles: HomeTiles;
  /** Live orders per fulfil date, keyed "YYYY-MM-DD", for the shown month. */
  countsByDate: Record<string, number>;
  /** Orders for `selectedDate`, oldest order number first. Empty when no date is selected. */
  dayOrders: HomeOrder[];
};

/**
 * Everything the Home page shows: the four tiles, the day counts for one month and the orders
 * for one selected day. Cancelled orders are left out of every count and list.
 */
export async function getHomeData(
  today: string,
  monthStart: string,
  selectedDate: string | null,
): Promise<HomeData> {
  const db = createAdminSupabase();
  const [counts, ready, dueToday, month] = await Promise.all([
    getAdminCounts(),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "ready"),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("fulfil_date", today)
      .neq("status", "cancelled"),
    db
      .from("orders")
      .select(
        "id, order_number, customer_name, status, fulfil_date, fulfilment, order_items(item_name, flavour, quantity, unit_label)",
      )
      .gte("fulfil_date", monthStart)
      .lte("fulfil_date", lastDayOfMonth(monthStart))
      .neq("status", "cancelled")
      .order("order_number", { ascending: true }),
  ]);
  if (ready.error) throw new Error(ready.error.message);
  if (dueToday.error) throw new Error(dueToday.error.message);
  if (month.error) throw new Error(month.error.message);

  const countsByDate: Record<string, number> = {};
  const dayOrders: HomeOrder[] = [];
  for (const row of month.data) {
    countsByDate[row.fulfil_date] = (countsByDate[row.fulfil_date] ?? 0) + 1;
    if (row.fulfil_date === selectedDate) {
      dayOrders.push({
        id: row.id,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        status: row.status as OrderStatus,
        fulfilment: row.fulfilment as "pickup" | "delivery",
        items: row.order_items.map((item) => ({
          name: item.item_name,
          flavour: item.flavour,
          quantity: item.quantity,
          unitLabel: item.unit_label,
        })),
      });
    }
  }

  return {
    tiles: {
      proofsToCheck: counts.proofsToCheck,
      readyToComplete: ready.count ?? 0,
      ordersToday: dueToday.count ?? 0,
    },
    countsByDate,
    dayOrders,
  };
}

// Order list ----------------------------------------------------------------

export type OrderListFilter = {
  /** A status, or "open" for everything that is not completed or cancelled. */
  status?: OrderStatus | "open";
  /** Matches order number, customer name or phone. */
  q?: string;
  /** Only orders with this fulfil date, "YYYY-MM-DD". */
  date?: string;
  /** 1-based. */
  page?: number;
};

export type OrderListRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  fulfilDate: string;
  status: OrderStatus;
  totalCents: number;
  fulfilment: "pickup" | "delivery";
};

/** Orders, newest first, 25 per page. `total` counts every match, not just this page. */
export async function listOrders(
  filter: OrderListFilter = {},
): Promise<{ rows: OrderListRow[]; total: number }> {
  const page = Number.isFinite(filter.page) && (filter.page as number) >= 1 ? Math.floor(filter.page as number) : 1;
  const from = (page - 1) * PAGE_SIZE;

  let query = createAdminSupabase()
    .from("orders")
    .select("id, order_number, customer_name, fulfil_date, status, total_cents, fulfilment", {
      count: "exact",
    });

  if (filter.status === "open") {
    query = query.not("status", "in", "(completed,cancelled)");
  } else if (filter.status) {
    query = query.eq("status", filter.status);
  }

  if (filter.date) query = query.eq("fulfil_date", filter.date);

  const term = cleanSearch(filter.q);
  if (term) {
    const pattern = `%${escapeLike(term)}%`;
    const clauses = [
      `order_number.ilike.${pattern}`,
      `customer_name.ilike.${pattern}`,
      `phone.ilike.${pattern}`,
    ];
    // Phones are stored as "+1-868-XXX-XXXX". With 7 or more digits typed, match the last seven
    // in that shape, so "8681234567" and "1234567" both find the customer.
    const digits = term.replace(/D/g, "");
    if (digits.length >= 7) {
      clauses.push(`phone.ilike.%${digits.slice(-7, -4)}-${digits.slice(-4)}%`);
    }
    query = query.or(clauses.join(","));
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);

  return {
    rows: data.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      fulfilDate: row.fulfil_date,
      status: row.status as OrderStatus,
      totalCents: row.total_cents,
      fulfilment: row.fulfilment as "pickup" | "delivery",
    })),
    total: count ?? 0,
  };
}

// Order detail --------------------------------------------------------------

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  accessToken: string;
  customerName: string;
  email: string;
  phone: string;
  status: OrderStatus;
  fulfilment: "pickup" | "delivery";
  fulfilDate: string;
  address: string | null;
  pickupLocation: string | null;
  allergies: string;
  notes: string | null;
  createdAt: string;
  subtotalCents: number;
  adjustmentsCents: number;
  totalCents: number;
  items: { name: string; flavour: string | null; unitLabel: string; quantity: number; unitPriceCents: number }[];
  latestPayment: {
    id: string;
    status: "submitted" | "confirmed" | "rejected";
    amountCents: number;
    reference: string | null;
    /** Storage path of the receipt file, echoed back to the review action. */
    receiptPath: string | null;
    /** Short-lived signed URL for the receipt file, or null if no file was uploaded. */
    receiptUrl: string | null;
    rejectReason: string | null;
    createdAt: string;
  } | null;
  /** Newest first. */
  events: { id: string; kind: string; detail: unknown; staffId: string | null; createdAt: string }[];
  /** Newest first. */
  emails: { template: string; toEmail: string; providerId: string | null; error: string | null; sentAt: string }[];
};

/** One order with its items, latest payment (with a signed receipt URL), events and emails. Null if not found. */
export async function getAdminOrder(id: string): Promise<AdminOrderDetail | null> {
  const { data, error } = await createAdminSupabase()
    .from("orders")
    .select("*, order_items(*, items(allergen_note)), payments(*), order_events(*), email_log(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const latest =
    [...data.payments].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  return {
    id: data.id,
    orderNumber: data.order_number,
    accessToken: data.access_token,
    customerName: data.customer_name,
    email: data.email,
    phone: data.phone,
    status: data.status as OrderStatus,
    fulfilment: data.fulfilment as "pickup" | "delivery",
    fulfilDate: data.fulfil_date,
    address: data.delivery_address,
    pickupLocation: data.pickup_location,
    allergies: data.allergies,
    notes: data.notes,
    createdAt: data.created_at,
    subtotalCents: data.subtotal_cents,
    adjustmentsCents: data.adjustments_cents,
    totalCents: data.total_cents,
    items: [...data.order_items]
      .sort((a, b) => a.item_name.localeCompare(b.item_name) || a.id.localeCompare(b.id))
      .map((item) => ({
        name: item.item_name,
        flavour: item.flavour,
        unitLabel: item.unit_label,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
      })),
    latestPayment: latest
      ? {
          id: latest.id,
          status: latest.status as "submitted" | "confirmed" | "rejected",
          amountCents: latest.amount_cents,
          reference: latest.reference,
          receiptPath: latest.receipt_path,
          receiptUrl: await signedReceiptUrl(latest.receipt_path),
          rejectReason: latest.reject_reason,
          createdAt: latest.created_at,
        }
      : null,
    events: [...data.order_events]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((event) => ({
        id: event.id,
        kind: event.kind,
        detail: event.detail,
        staffId: event.staff_id,
        createdAt: event.created_at,
      })),
    emails: [...data.email_log]
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
      .map((email) => ({
        template: email.template,
        toEmail: email.to_email,
        providerId: email.provider_id,
        error: email.error,
        sentAt: email.sent_at,
      })),
  };
}

// Payment queue ------------------------------------------------------------

export type PaymentQueueRow = {
  /** Null for a stuck proof, which has no payment row. */
  paymentId: string | null;
  orderId: string;
  orderNumber: string;
  customerName: string;
  fulfilDate: string;
  fulfilment: "pickup" | "delivery";
  totalCents: number;
  amountCents: number | null;
  reference: string | null;
  receiptPath: string | null;
  receiptUrl: string | null;
  /** When the proof was submitted, or when the order entered proof_submitted for a stuck proof. */
  waitingSince: string;
  /**
   * True when the order is in proof_submitted with no submitted payment row, which happens when an
   * upload crashed part way. Staff should ask the customer to upload again.
   */
  stuck: boolean;
};

/** Proofs waiting for review, oldest first. Includes stuck proofs (see PaymentQueueRow.stuck). */
export async function listPaymentQueue(): Promise<PaymentQueueRow[]> {
  const db = createAdminSupabase();
  const [payments, proofOrders] = await Promise.all([
    db
      .from("payments")
      .select(
        "id, order_id, amount_cents, reference, receipt_path, created_at, orders!inner(id, order_number, customer_name, fulfil_date, fulfilment, total_cents)",
      )
      .eq("status", "submitted")
      // A proof on an order that is no longer waiting for review (cancelled, say) cannot be acted on.
      .eq("orders.status", "proof_submitted")
      .order("created_at", { ascending: true }),
    db
      .from("orders")
      .select("id, order_number, customer_name, fulfil_date, fulfilment, total_cents, updated_at")
      .eq("status", "proof_submitted"),
  ]);
  if (payments.error) throw new Error(payments.error.message);
  if (proofOrders.error) throw new Error(proofOrders.error.message);

  const withProof = new Set(payments.data.map((p) => p.order_id));
  const receiptUrls = await signedReceiptUrls(
    payments.data.flatMap((p) => (p.receipt_path ? [p.receipt_path] : [])),
  );

  const submitted = payments.data.map((row): PaymentQueueRow | null => {
    const order = row.orders;
    if (!order) return null;
    return {
      paymentId: row.id,
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      fulfilDate: order.fulfil_date,
      fulfilment: order.fulfilment as "pickup" | "delivery",
      totalCents: order.total_cents,
      amountCents: row.amount_cents,
      reference: row.reference,
      receiptPath: row.receipt_path,
      receiptUrl: row.receipt_path ? (receiptUrls.get(row.receipt_path) ?? null) : null,
      waitingSince: row.created_at,
      stuck: false,
    };
  });

  const stuck: PaymentQueueRow[] = proofOrders.data
    .filter((order) => !withProof.has(order.id))
    .map((order) => ({
      paymentId: null,
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      fulfilDate: order.fulfil_date,
      fulfilment: order.fulfilment as "pickup" | "delivery",
      totalCents: order.total_cents,
      amountCents: null,
      reference: null,
      receiptPath: null,
      receiptUrl: null,
      waitingSince: order.updated_at,
      stuck: true,
    }));

  return [...submitted.filter((row): row is PaymentQueueRow => row !== null), ...stuck].sort((a, b) =>
    a.waitingSince.localeCompare(b.waitingSince),
  );
}
