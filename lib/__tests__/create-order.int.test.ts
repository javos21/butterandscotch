import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { DateUnavailableError, type NewOrder, type NewOrderItem } from "@/lib/orders/create-order";
import { buildOrderRepo } from "@/lib/orders/order-repo";

// The production repo imports the server-only admin client. Outside Next the package throws, so stub it.
vi.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = `order-${Date.now()}`;
const CAP_DATE = "2027-06-15";
const BLOCKED_DATE = "2027-06-16";
const NOW = "2026-11-23T12:00:00.000Z";

describe.skipIf(!url || !serviceKey)("order repo against local Supabase", () => {
  const service = (): SupabaseClient =>
    createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  function orderFor(suffix: string, fulfilDate: string): NewOrder {
    return {
      idempotency_key: `${stamp}-${suffix}`,
      access_token: `${stamp}-${suffix}-token`,
      customer_name: "Integration Test",
      email: `${stamp}-${suffix}@example.test`,
      phone: "5550100",
      fulfilment: "pickup",
      delivery_address: null,
      pickup_location: "West",
      fulfil_date: fulfilDate,
      allergies: "None",
      notes: null,
      broadcast_opt_in: false,
      broadcastConsentText: null,
      subtotal_cents: 1000,
      total_cents: 1000,
      status: "awaiting_payment",
      payment_window_started_at: NOW,
      policy_version: 1,
      policy_accepted_at: NOW,
    };
  }

  const lines: NewOrderItem[] = [
    {
      item_id: null,
      item_name: "Integration cake",
      flavour: null,
      unit_label: "cake",
      unit_price_cents: 1000,
      quantity: 1,
    },
  ];

  beforeAll(async () => {
    const { error } = await service().from("settings").update({ daily_order_cap: 1 }).eq("id", 1);
    if (error) throw error;
  });

  afterEach(async () => {
    const db = service();
    await db.from("orders").delete().in("fulfil_date", [CAP_DATE, BLOCKED_DATE]);
    await db.from("blocked_dates").delete().eq("date", BLOCKED_DATE);
    const { error } = await db.from("settings").update({ daily_order_cap: 1 }).eq("id", 1);
    if (error) throw error;
  });

  afterAll(async () => {
    await service().from("settings").update({ daily_order_cap: 10 }).eq("id", 1);
  });

  test("concurrent orders cannot exceed the cap", async () => {
    const repo = buildOrderRepo();

    const results = await Promise.allSettled([
      repo.insertOrder(orderFor("a", CAP_DATE), lines),
      repo.insertOrder(orderFor("b", CAP_DATE), lines),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(DateUnavailableError);
  });

  test("blocked date refused", async () => {
    const db = service();
    const { error } = await db.from("blocked_dates").insert({ date: BLOCKED_DATE, note: stamp });
    if (error) throw error;

    const repo = buildOrderRepo();
    await expect(repo.insertOrder(orderFor("blocked", BLOCKED_DATE), lines)).rejects.toBeInstanceOf(
      DateUnavailableError,
    );
  });
});
