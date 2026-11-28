import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { getOrderView } from "@/lib/orders/get-order";

// The module is server-only in the app. Tests run in node, so the guard is a no-op here.
vi.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = `getorder-${Date.now()}`;
const EMAIL = `${stamp}@example.test`;
const PHONE = "5550199";
const NOW = "2026-11-23T12:00:00.000Z";
const UNKNOWN_TOKEN = `${stamp}-unknown`;

describe.skipIf(!url || !anonKey || !serviceKey)(
  "getOrderView (local Supabase)",
  () => {
    const service = (): SupabaseClient =>
      createClient(url as string, serviceKey as string, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

    const orderIds: string[] = [];

    async function insertOrder(
      suffix: string,
      overrides: Record<string, unknown>,
    ): Promise<{ id: string; token: string }> {
      const token = `${stamp}-${suffix}-token`;
      const db = service();
      const order = await db
        .from("orders")
        .insert({
          customer_name: "Asha Test",
          email: EMAIL,
          phone: PHONE,
          fulfilment: "pickup",
          fulfil_date: "2027-07-01",
          allergies: "None",
          subtotal_cents: 14000,
          total_cents: 14000,
          status: "awaiting_payment",
          idempotency_key: `${stamp}-${suffix}-idem`,
          access_token: token,
          policy_version: 1,
          policy_accepted_at: NOW,
          ...overrides,
        })
        .select("id")
        .single();
      if (order.error) throw order.error;
      orderIds.push(order.data.id);

      const item = await db.from("order_items").insert({
        order_id: order.data.id,
        item_id: null,
        item_name: "Stamp Cupcake",
        flavour: "Vanilla",
        unit_label: "cupcake",
        unit_price_cents: 3500,
        quantity: 4,
      });
      if (item.error) throw item.error;

      return { id: order.data.id, token };
    }

    let payOrder: { id: string; token: string };
    let deliveryOrder: { id: string; token: string };
    let pickupOrder: { id: string; token: string };
    let bankSeed: unknown;
    let pickupSeed: string;

    beforeAll(async () => {
      const db = service();
      const settings = await db
        .from("settings")
        .select("bank_details, pickup_info")
        .eq("id", 1)
        .single();
      if (settings.error) throw settings.error;
      bankSeed = settings.data.bank_details;
      pickupSeed = settings.data.pickup_info;

      payOrder = await insertOrder("pay", {});
      deliveryOrder = await insertOrder("delivery", {
        fulfilment: "delivery",
        delivery_address: "1 Test Street",
        subtotal_cents: 14000,
        total_cents: 14000,
      });
      pickupOrder = await insertOrder("picked", {
        status: "confirmed",
        fulfilment: "pickup",
      });
    });

    afterAll(async () => {
      if (orderIds.length) await service().from("orders").delete().in("id", orderIds);
    });

    test("an order awaiting payment shows bank details, allows a proof upload and leaks no contact details", async () => {
      const view = await getOrderView(payOrder.token);
      expect(view).not.toBeNull();
      if (!view) return;

      expect(view.orderNumber).toMatch(/^BS-\d{4}$/);
      expect(view.status).toBe("awaiting_payment");
      expect(view.statusLabel).toBe("Awaiting payment — not confirmed");
      expect(view.customerName).toBe("Asha Test");
      expect(view.fulfilment).toBe("pickup");
      expect(view.fulfilDate).toBe("2027-07-01");
      expect(view.items).toEqual([
        {
          name: "Stamp Cupcake",
          flavour: "Vanilla",
          quantity: 4,
          unitLabel: "cupcake",
          lineTotalCents: 14000,
        },
      ]);
      expect(view.subtotalCents).toBe(14000);
      expect(view.totalCents).toBe(14000);
      expect(view.adjustmentsCents).toBe(0);
      expect(view.bank).toEqual(bankSeed);
      expect(view.canUploadProof).toBe(true);
      expect(view.latestPayment).toBeNull();
      expect(view.pickupInfo).toBeNull();
      expect(typeof view.whatsappNumber).toBe("string");

      expect(view).not.toHaveProperty("email");
      expect(view).not.toHaveProperty("phone");
      expect(view).not.toHaveProperty("token");
      const serialized = JSON.stringify(view);
      expect(serialized).not.toContain(EMAIL);
      expect(serialized).not.toContain(PHONE);
      expect(serialized).not.toContain(payOrder.token);
    });

    test("a delivery order shows its address and an items-only total, with no fee field", async () => {
      const view = await getOrderView(deliveryOrder.token);
      expect(view).not.toBeNull();
      expect(view?.status).toBe("awaiting_payment");
      expect(view?.bank).toEqual(bankSeed);
      expect(view?.canUploadProof).toBe(true);
      expect(view?.fulfilment).toBe("delivery");
      expect(view?.address).toBe("1 Test Street");
      expect(view?.totalCents).toBe(14000);
      expect(view).not.toHaveProperty("areaName");
      expect(view).not.toHaveProperty("deliveryFeeCents");
    });

    test("a confirmed pickup order shows the pickup info and no bank details", async () => {
      const view = await getOrderView(pickupOrder.token);
      expect(view).not.toBeNull();
      expect(view?.status).toBe("confirmed");
      expect(view?.bank).toBeNull();
      expect(view?.canUploadProof).toBe(false);
      expect(view?.pickupInfo).toBe(pickupSeed);
      expect(view?.pickupInfo).not.toBeNull();
    });

    test("an unknown token returns null", async () => {
      await expect(getOrderView(UNKNOWN_TOKEN)).resolves.toBeNull();
    });
  },
);
