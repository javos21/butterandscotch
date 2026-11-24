import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { changeDate, type OrderActionDeps } from "@/lib/admin/order-actions";
import { adminOrderRepo } from "@/lib/admin/orders-repo";
import type { EmailDeps, EmailLogEntry } from "@/lib/email/types";

vi.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const staffEmail = process.env.SEED_STAFF_EMAIL;
const staffPassword = process.env.SEED_STAFF_PASSWORD;

const stamp = `order-actions-${Date.now()}`;
const START_DATE = "2027-09-10";
const FULL_DATE = "2027-09-11";
const BLOCKED_DATE = "2027-09-12";
const TEST_DATES = [START_DATE, FULL_DATE, BLOCKED_DATE];
const NOW = new Date("2026-11-24T14:00:00Z");
const BLOCKED_MESSAGE = "That date is blocked. Unblock it in Settings first.";
const FULL_MESSAGE = "That day is full. Tick “Override daily limit” to add it anyway.";

describe.skipIf(!url || !anonKey || !serviceKey || !staffEmail || !staffPassword)(
  "changeDate against the real database (order-actions)",
  () => {
    const client = (key: string): SupabaseClient =>
      createClient(url as string, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const service = (): SupabaseClient => client(serviceKey as string);

    let originalCap = 10;
    let staff: SupabaseClient;
    let staffUserId = "";
    const orderIds: string[] = [];

    async function insertOrder(suffix: string, fulfilDate: string, status = "confirmed") {
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
          payment_window_started_at: NOW.toISOString(),
          policy_version: 1,
          policy_accepted_at: NOW.toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      orderIds.push(data.id as string);
      return data.id as string;
    }

    function recordingEmail(): { email: EmailDeps; logs: EmailLogEntry[] } {
      const logs: EmailLogEntry[] = [];
      return {
        logs,
        email: {
          provider: {
            async send() {
              return { id: "int-test" };
            },
          },
          async log(entry) {
            logs.push(entry);
          },
        },
      };
    }

    /** Production repo on the signed-in staff client, as the server action builds it. */
    function depsFor(email: EmailDeps): OrderActionDeps {
      return {
        repo: adminOrderRepo(staff as never),
        email,
        staff: { userId: staffUserId },
        now: () => NOW,
        getBank: async () => {
          throw new Error("not used by changeDate");
        },
        getPickupInfo: async () => "",
      };
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
      staffUserId = signIn.data.user?.id ?? "";
    });

    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test");
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
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

    test("a blocked date returns the exact blocked message and sends no email", async () => {
      await service().from("blocked_dates").insert({ date: BLOCKED_DATE, note: "test" });
      const id = await insertOrder("blocked", START_DATE);
      const mail = recordingEmail();

      const result = await changeDate(
        { orderId: id, newDate: BLOCKED_DATE, overrideCap: false },
        depsFor(mail.email),
      );

      expect(result).toEqual({ error: BLOCKED_MESSAGE });
      const unchanged = await service().from("orders").select("fulfil_date").eq("id", id).single();
      expect(unchanged.data?.fulfil_date).toBe(START_DATE);
    });

    test("a full date returns the exact full message without override", async () => {
      await insertOrder("other", FULL_DATE);
      const id = await insertOrder("mover", START_DATE);
      const mail = recordingEmail();

      const result = await changeDate(
        { orderId: id, newDate: FULL_DATE, overrideCap: false },
        depsFor(mail.email),
      );

      expect(result).toEqual({ error: FULL_MESSAGE });
      const unchanged = await service().from("orders").select("fulfil_date").eq("id", id).single();
      expect(unchanged.data?.fulfil_date).toBe(START_DATE);
    });

    test("override moves the order onto a full date, sends the email and logs a date_changed event", async () => {
      await insertOrder("other", FULL_DATE);
      const id = await insertOrder("mover", START_DATE);
      const mail = recordingEmail();

      const result = await changeDate(
        { orderId: id, newDate: FULL_DATE, overrideCap: true },
        depsFor(mail.email),
      );

      expect(result).toEqual({ ok: true, emailFailed: false });
      const moved = await service().from("orders").select("fulfil_date").eq("id", id).single();
      expect(moved.data?.fulfil_date).toBe(FULL_DATE);

      const events = await service().from("order_events").select("kind").eq("order_id", id);
      expect(events.data?.map((row) => row.kind)).toContain("date_changed");
      expect(mail.logs).toHaveLength(1);
      expect(mail.logs[0].template).toBe("date_changed");
    });
  },
);
