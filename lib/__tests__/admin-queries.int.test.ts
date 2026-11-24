import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { getAdminOrder, listOrders, listPaymentQueue } from "@/lib/admin/queries";

// The module is server-only in the app. Tests run in node, so the guard is a no-op here.
vi.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = `admq-${Date.now()}`;
const BULK_NAME = `${stamp}-bulk`;
const CANCELLED_NAME = `${stamp}-cx`;
const NOW = "2026-11-23T12:00:00.000Z";

describe.skipIf(!url || !serviceKey)("admin read models (local Supabase)", () => {
  const service = (): SupabaseClient =>
    createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const orderIds: string[] = [];
  const storagePaths: string[] = [];
  let cancelledId: string;
  let cancelledProofOrderId: string;
  let phoneId: string;
  let stuckId: string;
  let reviewId: string;
  let receiptId: string;
  const receiptPath = `${stamp}/receipt.txt`;

  async function insertOrder(
    suffix: string,
    customerName: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const db = service();
    const order = await db
      .from("orders")
      .insert({
        customer_name: customerName,
        email: `${stamp}@example.test`,
        phone: "5550199",
        fulfilment: "pickup",
        fulfil_date: "2027-08-01",
        allergies: "None",
        subtotal_cents: 14000,
        total_cents: 14000,
        status: "awaiting_payment",
        idempotency_key: `${stamp}-${suffix}-idem`,
        access_token: `${stamp}-${suffix}-token`,
        policy_version: 1,
        policy_accepted_at: NOW,
        ...overrides,
      })
      .select("id")
      .single();
    if (order.error) throw order.error;
    orderIds.push(order.data.id);
    return order.data.id;
  }

  beforeAll(async () => {
    const db = service();

    // 26 open orders so the list spans two pages.
    for (let i = 0; i < 26; i++) {
      await insertOrder(`bulk-${i}`, BULK_NAME);
    }
    cancelledId = await insertOrder("cancelled", CANCELLED_NAME, { status: "cancelled" });

    // A proof that was waiting when the order was cancelled. It must not be in the queue.
    const closedProofId = await insertOrder("closed-proof", `${stamp}-closed`, { status: "cancelled" });
    cancelledProofOrderId = closedProofId;
    const closedPayment = await db.from("payments").insert({
      order_id: closedProofId,
      amount_cents: 14000,
      reference: "BANK-REF-CLOSED",
      status: "submitted",
    });
    if (closedPayment.error) throw closedPayment.error;

    // A customer's phone in the stored +1-868 format, to test digit search.
    phoneId = await insertOrder("phone", `${stamp}-phone`, { phone: "+1-868-734-2290" });

    // Proof submitted but the upload crashed before the payment row was written.
    stuckId = await insertOrder("stuck", `${stamp}-misc`, { status: "proof_submitted" });

    // Proof submitted and waiting for review.
    reviewId = await insertOrder("review", `${stamp}-misc`, { status: "proof_submitted" });
    const payment = await db.from("payments").insert({
      order_id: reviewId,
      amount_cents: 14000,
      reference: "BANK-REF-1",
      status: "submitted",
    });
    if (payment.error) throw payment.error;

    // Order with a receipt file, one event and one email.
    receiptId = await insertOrder("receipt", `${stamp}-rcpt`, {
      status: "confirmed",
      fulfilment: "pickup",
    });
    const upload = await db.storage
      .from("receipts")
      .upload(receiptPath, new Blob(["receipt"], { type: "text/plain" }), {
        contentType: "text/plain",
      });
    if (upload.error) throw upload.error;
    storagePaths.push(receiptPath);
    const receiptPayment = await db.from("payments").insert({
      order_id: receiptId,
      amount_cents: 14000,
      reference: "BANK-REF-2",
      receipt_path: receiptPath,
      status: "confirmed",
    });
    if (receiptPayment.error) throw receiptPayment.error;
    const event = await db.from("order_events").insert({
      order_id: receiptId,
      kind: "payment_confirmed",
      detail: {},
    });
    if (event.error) throw event.error;
    const email = await db.from("email_log").insert({
      order_id: receiptId,
      template: "order_confirmed",
      to_email: `${stamp}@example.test`,
    });
    if (email.error) throw email.error;
  });

  afterAll(async () => {
    const db = service();
    if (storagePaths.length) await db.storage.from("receipts").remove(storagePaths);
    if (orderIds.length) await db.from("orders").delete().in("id", orderIds);
  });

  test("listOrders with q pages at 25 per page, newest first", async () => {
    const first = await listOrders({ q: BULK_NAME });
    expect(first.total).toBe(26);
    expect(first.rows).toHaveLength(25);

    const second = await listOrders({ q: BULK_NAME, page: 2 });
    expect(second.total).toBe(26);
    expect(second.rows).toHaveLength(1);

    const shape = first.rows[0];
    expect(shape.orderNumber).toMatch(/^BS-\d{4}$/);
    expect(shape.customerName).toBe(BULK_NAME);
    expect(typeof shape.totalCents).toBe("number");
  });

  test("q with LIKE wildcards matches literally, not as a pattern", async () => {
    // Unescaped, "%" would match every order. Escaped, it matches only a literal percent sign.
    const wildcard = await listOrders({ q: "%" });
    expect(wildcard.total).toBe(0);
    const underscore = await listOrders({ q: `${stamp}_bulk` });
    expect(underscore.total).toBe(0);
  });

  test("status open excludes cancelled orders", async () => {
    const cancelled = await listOrders({ q: CANCELLED_NAME, status: "cancelled" });
    expect(cancelled.total).toBe(1);
    expect(cancelled.rows[0].id).toBe(cancelledId);
    const open = await listOrders({ q: CANCELLED_NAME, status: "open" });
    expect(open.total).toBe(0);
    expect(open.rows).toEqual([]);

    const everything = await listOrders({ q: stamp });
    expect(everything.rows.some((r) => r.status === "cancelled")).toBe(true);
    const openAll = await listOrders({ q: stamp, status: "open" });
    expect(openAll.rows.some((r) => r.status === "cancelled" || r.status === "completed")).toBe(false);
    expect(openAll.rows.some((r) => r.status === "cancelled")).toBe(false);
  });

  test("stuck proof appears in queue", async () => {
    const queue = await listPaymentQueue();
    const stuck = queue.find((row) => row.orderId === stuckId);
    expect(stuck).toBeDefined();
    expect(stuck?.stuck).toBe(true);
    expect(stuck?.receiptUrl).toBeNull();

    const reviewed = queue.find((row) => row.orderId === reviewId);
    expect(reviewed).toBeDefined();
    expect(reviewed?.stuck).toBe(false);
  });

  test("queue leaves out a submitted payment whose order was cancelled", async () => {
    const queue = await listPaymentQueue();
    expect(queue.some((row) => row.orderId === cancelledProofOrderId)).toBe(false);
    expect(queue.some((row) => row.orderId === reviewId)).toBe(true);
  });

  test("date filters to one fulfil date", async () => {
    // insertOrder defaults fulfil_date to 2027-08-01.
    const onDay = await listOrders({ q: BULK_NAME, date: "2027-08-01" });
    expect(onDay.total).toBe(26);
    expect(onDay.rows.every((row) => row.fulfilDate === "2027-08-01")).toBe(true);

    const otherDay = await listOrders({ q: BULK_NAME, date: "2027-08-02" });
    expect(otherDay.total).toBe(0);
  });

  test("phone search matches the last seven digits of a stored +1-868 number", async () => {
    for (const q of ["7342290", "8687342290", "868-734-2290"]) {
      const found = await listOrders({ q });
      expect(found.rows.some((row) => row.id === phoneId), q).toBe(true);
    }
    const miss = await listOrders({ q: "7342291" });
    expect(miss.rows.some((row) => row.id === phoneId)).toBe(false);
  });

  test("getAdminOrder returns a signed receipt URL, events and emails", async () => {
    const order = await getAdminOrder(receiptId);
    expect(order).not.toBeNull();
    if (!order) return;

    expect(order.id).toBe(receiptId);
    expect(order.latestPayment).not.toBeNull();
    expect(typeof order.latestPayment?.receiptUrl).toBe("string");
    expect(order.latestPayment?.receiptUrl).toMatch(/^https?:\/\//);
    expect(order.events.map((e) => e.kind)).toContain("payment_confirmed");
    expect(order.emails.map((e) => e.template)).toContain("order_confirmed");
  });

  test("getAdminOrder returns null for an unknown id", async () => {
    await expect(getAdminOrder("00000000-0000-4000-8000-000000000000")).resolves.toBeNull();
  });
});
