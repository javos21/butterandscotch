import "server-only";
import { requireStaff } from "@/lib/auth/require-staff";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type CustomerRecord = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  broadcast_opt_in: boolean;
  broadcast_opt_in_at: string | null;
  community_opt_in: boolean;
};

export type CustomerOrderRecord = {
  customer_id: string | null;
  total_cents: number;
  status: string;
};

export type CustomerSummary = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  totalSpentCents: number;
  broadcastOptIn: boolean;
  communityOptIn: boolean;
};

export type CustomerFilter = { optedIn?: boolean };

const CUSTOMER_COLUMNS =
  "id, email, name, phone, broadcast_opt_in, broadcast_opt_in_at, community_opt_in";

/**
 * Pure: one summary per customer. Cancelled orders and orders with no customer are left out of the
 * count and the total. Customers with no orders get 0 and 0. Names sort first, blanks last.
 */
export function summariseCustomers(
  customers: CustomerRecord[],
  orders: CustomerOrderRecord[],
  filter: CustomerFilter = {},
): CustomerSummary[] {
  const totals = new Map<string, { count: number; cents: number }>();
  for (const order of orders) {
    if (!order.customer_id || order.status === "cancelled") continue;
    const running = totals.get(order.customer_id) ?? { count: 0, cents: 0 };
    running.count += 1;
    running.cents += order.total_cents;
    totals.set(order.customer_id, running);
  }

  return customers
    .filter((c) => filter.optedIn === undefined || c.broadcast_opt_in === filter.optedIn)
    .map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      phone: c.phone,
      orderCount: totals.get(c.id)?.count ?? 0,
      totalSpentCents: totals.get(c.id)?.cents ?? 0,
      broadcastOptIn: c.broadcast_opt_in,
      communityOptIn: c.community_opt_in,
    }))
    .sort(
      (a, b) =>
        (a.name ? 0 : 1) - (b.name ? 0 : 1) ||
        (a.name ?? "").localeCompare(b.name ?? "") ||
        a.email.localeCompare(b.email),
    );
}

/** Staff customer list with order totals. Runs requireStaff() before reading anything. */
export async function listCustomers(filter: CustomerFilter = {}): Promise<CustomerSummary[]> {
  await requireStaff();
  const db = createAdminSupabase();
  const [customers, orders] = await Promise.all([
    db.from("customers").select(CUSTOMER_COLUMNS),
    db
      .from("orders")
      .select("customer_id, total_cents, status")
      .not("customer_id", "is", null)
      .neq("status", "cancelled"),
  ]);
  if (customers.error) throw new Error(customers.error.message);
  if (orders.error) throw new Error(orders.error.message);
  return summariseCustomers(customers.data ?? [], orders.data ?? [], filter);
}

/**
 * Opted-in customers for the broadcast export. Callers must run requireStaff() first (the export
 * route does). Only broadcast_opt_in = true rows are returned.
 */
export async function loadBroadcastCustomers(): Promise<CustomerRecord[]> {
  const { data, error } = await createAdminSupabase()
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("broadcast_opt_in", true)
    .order("email");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** A value a spreadsheet would read as a formula once it starts with one of these. */
const FORMULA_START = /^[=+\-@\t\r]/;
/** Phone numbers may start with + or - (as +1868... does), so the phone column is exempt when the whole value is phone-shaped. */
const PHONE_SHAPE = /^\+?[\d\s()-]+$/;

/**
 * RFC 4180 field. A value that starts with = + - @ tab or CR gets a leading single quote, so a
 * spreadsheet shows it as text (formula injection). The phone column is exempt for values that
 * are phone-shaped. The quote is added before RFC 4180 quoting, so "=1,2" becomes "'=1,2".
 */
export function csvField(value: string | null | undefined, column: "text" | "phone" = "text"): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  const exempt = column === "phone" && PHONE_SHAPE.test(text);
  if (!exempt && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Pure: the broadcast export as CSV. Only broadcast opt-ins are written, whatever the input. */
export function broadcastCsv(customers: CustomerRecord[]): string {
  const header = "email,name,phone,broadcast_opt_in_at";
  const rows = customers
    .filter((c) => c.broadcast_opt_in)
    .map((c) =>
      [
        csvField(c.email),
        csvField(c.name),
        csvField(c.phone, "phone"),
        csvField(c.broadcast_opt_in_at),
      ].join(","),
    );
  return [header, ...rows].join("\r\n") + "\r\n";
}
