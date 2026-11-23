import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = `rls-${Date.now()}`;
const INACTIVE_ITEM_ID = "00000000-0000-0000-0000-00000000ff01";
const SECTION_ID = "00000000-0000-0000-0000-0000000000c1";

describe.skipIf(!url || !anonKey || !serviceKey)(
  "row-level security (local Supabase)",
  () => {
    const anon = (): SupabaseClient =>
      createClient(url as string, anonKey as string, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const service = (): SupabaseClient =>
      createClient(url as string, serviceKey as string, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

    let orderId: string;

    beforeAll(async () => {
      const db = service();

      const item = await db.from("items").insert({
        id: INACTIVE_ITEM_ID,
        section_id: SECTION_ID,
        name: "RLS inactive item",
        unit_label: "each",
        price_cents: 100,
        active: false,
        sort: 999,
      });
      if (item.error) throw item.error;

      const order = await db
        .from("orders")
        .insert({
          customer_name: "RLS Test",
          email: `${stamp}@example.test`,
          phone: "000",
          fulfilment: "pickup",
          fulfil_date: "2027-02-01",
          allergies: "None",
          subtotal_cents: 1000,
          total_cents: 1000,
          idempotency_key: `${stamp}-idem`,
          access_token: `${stamp}-token`,
          policy_version: 1,
          policy_accepted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (order.error) throw order.error;
      orderId = order.data.id;

      const payment = await db.from("payments").insert({
        order_id: orderId,
        amount_cents: 1000,
        reference: `${stamp}-ref`,
        receipt_path: `${stamp}/receipt.pdf`,
        status: "submitted",
      });
      if (payment.error) throw payment.error;

      const blocked = await db
        .from("blocked_dates")
        .insert({ date: "2027-02-02", note: `${stamp} blocked` });
      if (blocked.error) throw blocked.error;
    });

    afterAll(async () => {
      const db = service();
      await db.from("blocked_dates").delete().eq("date", "2027-02-02");
      if (orderId) await db.from("orders").delete().eq("id", orderId);
      await db.from("items").delete().eq("id", INACTIVE_ITEM_ID);
    });

    test("anonymous client sees no orders, payments or blocked dates", async () => {
      for (const table of ["orders", "payments", "blocked_dates"] as const) {
        const { data } = await anon().from(table).select("*");
        expect(data ?? [], table).toHaveLength(0);
      }
    });

    test("anonymous client sees no settings table rows", async () => {
      const { data } = await anon().from("settings").select("*");
      expect(data ?? []).toHaveLength(0);
    });

    test("public_settings returns one row and never exposes notify_email", async () => {
      const { data, error } = await anon().from("public_settings").select("*");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]).not.toHaveProperty("notify_email");
      expect(data?.[0]).toHaveProperty("store_open");
    });

    test("anonymous client reads only active items", async () => {
      const { data, error } = await anon().from("items").select("id, active");
      expect(error).toBeNull();
      expect(data?.length ?? 0).toBeGreaterThan(0);
      expect(data?.map((i) => i.id)).not.toContain(INACTIVE_ITEM_ID);
      for (const row of data ?? []) expect(row.active).toBe(true);
    });

    test("anonymous client cannot insert an order", async () => {
      const { error } = await anon()
        .from("orders")
        .insert({
          customer_name: "Test",
          email: "anon@example.test",
          phone: "000",
          fulfilment: "pickup",
          fulfil_date: "2027-02-03",
          allergies: "None",
          subtotal_cents: 1000,
          total_cents: 1000,
          idempotency_key: `${stamp}-anon`,
          access_token: `${stamp}-anon-token`,
          policy_version: 1,
          policy_accepted_at: new Date().toISOString(),
        });
      expect(error).not.toBeNull();
    });

    test("anonymous client cannot call next_order_number", async () => {
      const { error } = await anon().rpc("next_order_number");
      expect(error).not.toBeNull();
    });

    test("anonymous client cannot call create_order_with_items", async () => {
      const { error } = await anon().rpc("create_order_with_items", {
        order_data: {
          access_token: `${stamp}-rpc-token`,
          idempotency_key: `${stamp}-rpc`,
          customer_name: "RPC Test",
          email: "rpc@example.test",
          phone: "000",
          fulfilment: "pickup",
          fulfil_date: "2027-02-04",
          allergies: "None",
          subtotal_cents: 1000,
          total_cents: 1000,
          policy_version: 1,
          policy_accepted_at: new Date().toISOString(),
        },
        items: [],
      });
      expect(error).not.toBeNull();
    });

    test("service role sees the fixture order", async () => {
      const { data, error } = await service()
        .from("orders")
        .select("id")
        .eq("id", orderId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  },
);
