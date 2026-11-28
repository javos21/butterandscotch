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

/** RFC 4180 field: wrapped in quotes when it holds a comma, a quote or a line break. */
export function csvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Pure: the broadcast export as CSV. Only broadcast opt-ins are written, whatever the input. */
export function broadcastCsv(customers: CustomerRecord[]): string {
  const header = "email,name,phone,broadcast_opt_in_at";
  const rows = customers
    .filter((c) => c.broadcast_opt_in)
    .map((c) =>
      [c.email, c.name, c.phone, c.broadcast_opt_in_at].map(csvField).join(","),
    );
  return [header, ...rows].join("\r\n") + "\r\n";
}
