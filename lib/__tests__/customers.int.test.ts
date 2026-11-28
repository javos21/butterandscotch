import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { NewOrder, NewOrderItem } from "@/lib/orders/create-order";
import { buildOrderRepo } from "@/lib/orders/order-repo";

// The production repo imports the server-only admin client. Outside Next the package throws, so stub it.
vi.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = `cust-${Date.now()}`;
const FULFIL_DATE = "2027-08-10";
const NOW = "2026-11-23T12:00:00.000Z";

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

describe.skipIf(!url || !serviceKey)("customer records written by create_order_with_items", () => {
  const service = (): SupabaseClient =>
    createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  let originalCap: number;

  function order(suffix: string, overrides: Partial<NewOrder> = {}): NewOrder {
    return {
      idempotency_key: `${stamp}-${suffix}`,
      access_token: `${stamp}-${suffix}-token`,
      customer_name: "Anna",
      email: `${stamp}-anna@example.test`,
      phone: "5550100",
      fulfilment: "pickup",
      delivery_address: null,
      fulfil_date: FULFIL_DATE,
      allergies: "None",
      notes: null,
      broadcast_opt_in: false,
      broadcastConsentText: null,
      pickup_location: null,
      subtotal_cents: 1000,
      total_cents: 1000,
      status: "awaiting_payment",
      payment_window_started_at: NOW,
      policy_version: 1,
      policy_accepted_at: NOW,
      ...overrides,
    };
  }

  beforeAll(async () => {
    const db = service();
    const { data, error } = await db.from("settings").select("daily_order_cap").eq("id", 1).single();
    if (error) throw error;
    originalCap = data.daily_order_cap;
    const { error: updateError } = await db
      .from("settings")
      .update({ daily_order_cap: 1000 })
      .eq("id", 1);
    if (updateError) throw updateError;
  });

  afterAll(async () => {
    const db = service();
    await db.from("orders").delete().like("idempotency_key", `${stamp}%`);
    await db.from("customers").delete().like("email", `${stamp}%`);
    await db.from("settings").update({ daily_order_cap: originalCap }).eq("id", 1);
  });

  async function customerFor(email: string) {
    const { data, error } = await service()
      .from("customers")
      .select("*")
      .eq("email", email)
      .single();
    if (error) throw error;
    return data;
  }

  test("an order creates a customer keyed by the lowercased email and links it", async () => {
    const repo = buildOrderRepo();
    const email = `${stamp}-Mixed@Example.test`.toLowerCase();
    const placed = await repo.insertOrder(
      order("link", { email: `${stamp}-Mixed@Example.test` }),
      lines,
    );
    expect(placed.created).toBe(true);

    const customer = await customerFor(email);
    const { data: row } = await service()
      .from("orders")
      .select("customer_id, email")
      .eq("id", placed.id)
      .single();
    expect(row?.customer_id).toBe(customer.id);
    expect(row?.email).toBe(email);
  });

  test("a second order with the same email in another case joins the same customer", async () => {
    const repo = buildOrderRepo();
    const base = `${stamp}-joiner`;
    const first = await repo.insertOrder(order("join-1", { email: `${base}@Example.test` }), lines);
    const second = await repo.insertOrder(order("join-2", { email: `${base}@example.test` }), lines);

    const { data: rows } = await service()
      .from("orders")
      .select("id, customer_id")
      .in("id", [first.id, second.id]);
    expect(rows?.[0].customer_id).toBeTruthy();
    expect(rows?.[0].customer_id).toBe(rows?.[1].customer_id);
  });

  test("opt-in timestamp is set when the opt-in turns on, and never cleared by a later order", async () => {
    const repo = buildOrderRepo();
    const email = `${stamp}-optin@example.test`;

    await repo.insertOrder(order("opt-1", { email, broadcast_opt_in: false }), lines);
    const afterOff = await customerFor(email);
    expect(afterOff.broadcast_opt_in).toBe(false);
    expect(afterOff.broadcast_opt_in_at).toBeNull();

    await repo.insertOrder(order("opt-2", { email, broadcast_opt_in: true }), lines);
    const afterOn = await customerFor(email);
    expect(afterOn.broadcast_opt_in).toBe(true);
    expect(afterOn.broadcast_opt_in_at).not.toBeNull();
    const firstOptIn = afterOn.broadcast_opt_in_at;

    // A later order with the box unticked must not clear the opt-in or move its timestamp.
    await repo.insertOrder(order("opt-3", { email, broadcast_opt_in: false }), lines);
    const afterLater = await customerFor(email);
    expect(afterLater.broadcast_opt_in).toBe(true);
    expect(afterLater.broadcast_opt_in_at).toBe(firstOptIn);

    // Ticking again while already opted in does not reset the timestamp either.
    await repo.insertOrder(order("opt-4", { email, broadcast_opt_in: true }), lines);
    const afterRepeat = await customerFor(email);
    expect(afterRepeat.broadcast_opt_in_at).toBe(firstOptIn);
  });

  test("the consent text is stored at the first opt-in and kept by later orders", async () => {
    const repo = buildOrderRepo();
    const email = `${stamp}-consent@example.test`;
    const text = "Opt in to our WhatsApp broadcast for offers";

    await repo.insertOrder(order("consent-1", { email, broadcast_opt_in: false }), lines);
    expect((await customerFor(email)).broadcast_consent_text).toBeNull();

    await repo.insertOrder(
      order("consent-2", { email, broadcast_opt_in: true, broadcastConsentText: text }),
      lines,
    );
    expect((await customerFor(email)).broadcast_consent_text).toBe(text);

    // A later tick with different text does not overwrite the text shown at the first opt-in.
    await repo.insertOrder(
      order("consent-3", { email, broadcast_opt_in: true, broadcastConsentText: "Changed wording" }),
      lines,
    );
    expect((await customerFor(email)).broadcast_consent_text).toBe(text);
  });

  test("the pickup location is stored on the order, and null for a delivery", async () => {
    const repo = buildOrderRepo();
    const email = `${stamp}-pickup-loc@example.test`;

    const pickup = await repo.insertOrder(
      order("loc-1", { email, pickup_location: "Chaguanas" }),
      lines,
    );
    const delivery = await repo.insertOrder(
      order("loc-2", {
        email,
        fulfilment: "delivery",
        delivery_address: "12 Frederick St, Port of Spain",
        pickup_location: null,
      }),
      lines,
    );

    const { data: rows } = await service()
      .from("orders")
      .select("id, pickup_location")
      .in("id", [pickup.id, delivery.id]);
    expect(rows?.find((row) => row.id === pickup.id)?.pickup_location).toBe("Chaguanas");
    expect(rows?.find((row) => row.id === delivery.id)?.pickup_location).toBeNull();
  });

  test("the order keeps the name typed at checkout after the customer record changes", async () => {
    const repo = buildOrderRepo();
    const email = `${stamp}-snapshot@example.test`;

    const first = await repo.insertOrder(
      order("snap-1", { email, customer_name: "Anna", phone: "5550100" }),
      lines,
    );
    await repo.insertOrder(
      order("snap-2", { email, customer_name: "Anna B", phone: "5550199" }),
      lines,
    );

    const customer = await customerFor(email);
    expect(customer.name).toBe("Anna B");
    expect(customer.phone).toBe("5550199");

    const { data: old } = await service()
      .from("orders")
      .select("customer_name, phone")
      .eq("id", first.id)
      .single();
    expect(old?.customer_name).toBe("Anna");
    expect(old?.phone).toBe("5550100");
  });
});
