import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const staffEmail = process.env.SEED_STAFF_EMAIL;
const staffPassword = process.env.SEED_STAFF_PASSWORD;

const stamp = `change-${Date.now()}`;
const START_DATE = "2027-07-10";
const FULL_DATE = "2027-07-11";
const BLOCKED_DATE = "2027-07-12";
const TEST_DATES = [START_DATE, FULL_DATE, BLOCKED_DATE];
const NOW = "2026-11-23T12:00:00.000Z";

describe.skipIf(!url || !anonKey || !serviceKey || !staffEmail || !staffPassword)(
  "staff_change_fulfil_date (local Supabase)",
  () => {
    const client = (key: string): SupabaseClient =>
      createClient(url as string, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const service = (): SupabaseClient => client(serviceKey as string);

    let originalCap = 10;
    let staff: SupabaseClient;
    const orderIds: string[] = [];

    async function insertOrder(suffix: string, fulfilDate: string, status = "awaiting_payment") {
      const { data, error } = await service()
        .from("orders")
        .insert({
          idempotency_key: `${stamp}-${suffix}`,
          access_token: `${stamp}-${suffix}-token`,
          customer_name: "Integration Test",
          email: `${stamp}-${suffix}@example.test`,
          phone: "5550100",
          fulfilment: "pickup",
          fulfil_date: fulfilDate,
          allergies: "None",
          subtotal_cents: 1000,
          total_cents: 1000,
          status,
          payment_window_started_at: NOW,
          policy_version: 1,
          policy_accepted_at: NOW,
        })
        .select("id")
        .single();
      if (error) throw error;
      orderIds.push(data.id as string);
      return data.id as string;
    }

    beforeAll(async () => {
      const { data, error } = await service()
        .from("settings")
        .select("daily_order_cap")
        .eq("id", 1)
        .single();
      if (error) throw error;
      originalCap = data.daily_order_cap as number;

      const set = await service().from("settings").update({ daily_order_cap: 1 }).eq("id", 1);
      if (set.error) throw set.error;

      staff = client(anonKey as string);
      const signIn = await staff.auth.signInWithPassword({
        email: staffEmail as string,
        password: staffPassword as string,
      });
      if (signIn.error) throw signIn.error;
    });

    afterEach(async () => {
      const db = service();
      if (orderIds.length) {
        await db.from("orders").delete().in("id", orderIds.splice(0));
      }
      await db.from("orders").delete().in("fulfil_date", TEST_DATES);
      await db.from("blocked_dates").delete().in("date", TEST_DATES);
    });

    afterAll(async () => {
      await service().from("settings").update({ daily_order_cap: originalCap }).eq("id", 1);
    });

    test("a blocked date is refused even with override", async () => {
      await service().from("blocked_dates").insert({ date: BLOCKED_DATE, note: "test" });
      const id = await insertOrder("blocked", START_DATE);

      const { error } = await staff.rpc("staff_change_fulfil_date", {
        p_order_id: id,
        p_new_date: BLOCKED_DATE,
        p_override_cap: true,
      });
      expect(error?.message).toContain("date_blocked");
    });

    test("a full date is refused without override", async () => {
      await insertOrder("other", FULL_DATE);
      const id = await insertOrder("mover", START_DATE);

      const { error } = await staff.rpc("staff_change_fulfil_date", {
        p_order_id: id,
        p_new_date: FULL_DATE,
        p_override_cap: false,
      });
      expect(error?.message).toContain("date_full");
    });

    test("override moves an order onto a full date, returns the old date and logs an event", async () => {
      await insertOrder("other", FULL_DATE);
      const id = await insertOrder("mover", START_DATE);

      const { data, error } = await staff.rpc("staff_change_fulfil_date", {
        p_order_id: id,
        p_new_date: FULL_DATE,
        p_override_cap: true,
      });
      expect(error).toBeNull();
      expect(data).toBe(START_DATE);

      const moved = await service().from("orders").select("fulfil_date").eq("id", id).single();
      expect(moved.data?.fulfil_date).toBe(FULL_DATE);

      const events = await service()
        .from("order_events")
        .select("kind, detail")
        .eq("order_id", id);
      expect(events.data).toEqual([
        {
          kind: "date_changed",
          detail: { from: START_DATE, to: FULL_DATE, override: true },
        },
      ]);
    });

    test("an anonymous client is refused", async () => {
      const id = await insertOrder("anon", START_DATE);
      const anon = client(anonKey as string);

      const { error } = await anon.rpc("staff_change_fulfil_date", {
        p_order_id: id,
        p_new_date: FULL_DATE,
        p_override_cap: true,
      });
      expect(error).not.toBeNull();

      const unchanged = await service().from("orders").select("fulfil_date").eq("id", id).single();
      expect(unchanged.data?.fulfil_date).toBe(START_DATE);
    });

    test("a cancelled order cannot be moved", async () => {
      const id = await insertOrder("cancelled", START_DATE, "cancelled");

      const { error } = await staff.rpc("staff_change_fulfil_date", {
        p_order_id: id,
        p_new_date: FULL_DATE,
        p_override_cap: false,
      });
      expect(error?.message).toContain("order_closed");
    });
  },
);
