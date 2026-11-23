import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = `avail-${Date.now()}`;

describe.skipIf(!url || !anonKey || !serviceKey)(
  "public_unavailable_dates (local Supabase)",
  () => {
    const anon = (): SupabaseClient =>
      createClient(url as string, anonKey as string, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const service = (): SupabaseClient =>
      createClient(url as string, serviceKey as string, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

    const orderIds: string[] = [];

    const orderRow = (
      fulfilDate: string,
      status: "awaiting_payment" | "cancelled",
      suffix: string,
    ) => ({
      customer_name: "Availability Test",
      email: `${stamp}-${suffix}@example.test`,
      phone: "000",
      fulfilment: "pickup",
      fulfil_date: fulfilDate,
      allergies: "None",
      subtotal_cents: 1000,
      total_cents: 1000,
      status,
      idempotency_key: `${stamp}-${suffix}`,
      access_token: `${stamp}-${suffix}-token`,
      policy_version: 1,
      policy_accepted_at: new Date().toISOString(),
    });

    beforeAll(async () => {
      const db = service();

      const settings = await db
        .from("settings")
        .update({ daily_order_cap: 1 })
        .eq("id", 1);
      if (settings.error) throw settings.error;

      const blocked = await db
        .from("blocked_dates")
        .insert({ date: "2027-01-10", note: `${stamp} blocked` });
      if (blocked.error) throw blocked.error;

      const active = await db
        .from("orders")
        .insert(orderRow("2027-01-12", "awaiting_payment", "active"))
        .select("id")
        .single();
      if (active.error) throw active.error;
      orderIds.push(active.data.id);

      const cancelled = await db
        .from("orders")
        .insert(orderRow("2027-01-13", "cancelled", "cancelled"))
        .select("id")
        .single();
      if (cancelled.error) throw cancelled.error;
      orderIds.push(cancelled.data.id);
    });

    afterAll(async () => {
      const db = service();
      if (orderIds.length) {
        await db.from("orders").delete().in("id", orderIds);
      }
      await db.from("blocked_dates").delete().eq("date", "2027-01-10");
      await db.from("settings").update({ daily_order_cap: 10 }).eq("id", 1);
    });

    test("returns blocked dates and full dates, but not cancelled-only dates", async () => {
      const { data, error } = await anon().rpc("public_unavailable_dates", {
        from_date: "2027-01-01",
        to_date: "2027-01-31",
      });
      expect(error).toBeNull();
      expect([...(data as string[])].sort()).toEqual([
        "2027-01-10",
        "2027-01-12",
      ]);
    });
  },
);
