import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  submitProof,
  type ProofFile,
  type ProofOrder,
  type ProofPayment,
  type ProofRepo,
  type UpsertPendingPayment,
  type UpsertResult,
} from "@/lib/orders/submit-proof";
import type { EmailDeps, EmailLogEntry } from "@/lib/email/types";
import type { OrderStatus } from "@/lib/order-status";

const SITE = "https://shop.test/";
const ORDER_ID = "00000000-0000-0000-0000-00000000aaaa";
const TOKEN = "tok_abc-123";
const TOTAL = 64000;
const MB = 1024 * 1024;
const REFRESH_ERROR = "Your order was updated — please refresh";
const FILE_ERROR = "Please upload a JPG, PNG, WEBP, HEIC or PDF up to 4 MB";

function png(size = 2048): ProofFile {
  return { name: "receipt.png", type: "image/png", size, bytes: new ArrayBuffer(8) };
}

function fakeOrder(overrides: Partial<ProofOrder> = {}): ProofOrder {
  return {
    id: ORDER_ID,
    order_number: "BS-0001",
    access_token: TOKEN,
    customer_name: "Asha Mohan",
    email: "asha@example.test",
    status: "awaiting_payment",
    total_cents: TOTAL,
    payments: [],
    ...overrides,
  };
}

type Fake = {
  repo: ProofRepo;
  order: ProofOrder | null;
  payments: ProofPayment[];
  uploads: { path: string; file: ProofFile }[];
  deleted: string[];
  statuses: OrderStatus[];
  statusCalls: [OrderStatus, OrderStatus][];
  upserts: UpsertPendingPayment[];
  /** Makes the next upsert throw. */
  failUpsert: Error | null;
  /** "settled" forces a settled outcome: a submitted row confirmed or rejected before the write. */
  upsertOutcome: "settled" | null;
  /** False simulates the order having moved out of the status we read (a concurrent cancel). */
  statusMoves: boolean;
  /** Runs inside the upsert, after the status check and before the write (a race hook). */
  beforeWrite: (() => void) | null;
  /** Runs after the write, before the post-write status re-check (a race hook). */
  afterWrite: (() => void) | null;
  deletedPendingIds: string[];
};

/** In-memory repo. Its upsert follows the production rule: one submitted row per order. */
function fakeRepo(
  orderOverrides: Partial<ProofOrder> = {},
  settings: { notify_email: string | null } = { notify_email: "staff@example.test" },
): Fake {
  const fake: Omit<Fake, "repo"> = {
    order: fakeOrder(orderOverrides),
    payments: [],
    uploads: [],
    deleted: [],
    statuses: [],
    statusCalls: [],
    upserts: [],
    failUpsert: null,
    upsertOutcome: null,
    statusMoves: true,
    beforeWrite: null,
    afterWrite: null,
    deletedPendingIds: [],
  };
  if (orderOverrides.payments) fake.payments = [...orderOverrides.payments];

  const repo: ProofRepo = {
    async getOrderByToken(token) {
      if (!fake.order || token !== TOKEN) return null;
      return { ...fake.order, payments: fake.payments.map((row) => ({ ...row })) };
    },
    async getSettings() {
      return settings;
    },
    async uploadReceipt(path, file) {
      fake.uploads.push({ path, file });
    },
    async upsertPendingPayment(p) {
      if (fake.failUpsert) throw fake.failUpsert;
      if (fake.upsertOutcome === "settled") return { outcome: "settled" };
      fake.beforeWrite?.();
      fake.upserts.push(p);
      const existing = fake.payments.find((row) => row.status === "submitted");
      let result: UpsertResult;
      if (existing) {
        const replacedReceiptPath = existing.receipt_path;
        existing.amount_cents = p.amountCents;
        existing.reference = p.reference;
        existing.receipt_path = p.receiptPath;
        result = { outcome: "updated", paymentId: existing.id, replacedReceiptPath };
      } else {
        const row: ProofPayment = {
          id: `pay-${fake.payments.length + 1}`,
          status: "submitted",
          amount_cents: p.amountCents,
          reference: p.reference,
          receipt_path: p.receiptPath,
          reject_reason: null,
        };
        fake.payments.push(row);
        result = { outcome: "inserted", paymentId: row.id };
      }
      fake.afterWrite?.();
      return result;
    },
    /** Deletes only a submitted row. Returns false when the row was already settled. */
    async deletePendingPayment(paymentId) {
      fake.deletedPendingIds.push(paymentId);
      const row = fake.payments.find((p) => p.id === paymentId);
      if (!row || row.status !== "submitted") return false;
      fake.payments = fake.payments.filter((p) => p !== row);
      return true;
    },
    async deleteReceipt(path) {
      fake.deleted.push(path);
    },
    async setStatus(_orderId, from, to) {
      fake.statusCalls.push([from, to]);
      if (!fake.statusMoves || fake.order?.status !== from) return false;
      if (from !== to) fake.statuses.push(to);
      if (fake.order) fake.order.status = to;
      return true;
    },
  };

  return Object.assign(fake, { repo }) as Fake;
}

function fakeEmail(sendImpl?: () => Promise<{ id: string }>) {
  const send = vi.fn<(msg: { to: string; subject: string; html: string }) => Promise<{ id: string }>>(
    async () => (sendImpl ? sendImpl() : { id: "msg-1" }),
  );
  const logs: EmailLogEntry[] = [];
  const deps: EmailDeps = {
    provider: { send },
    log: async (entry) => {
      logs.push(entry);
    },
  };
  return { deps, send, logs };
}

function input(overrides: Partial<Parameters<typeof submitProof>[0]> = {}) {
  return {
    token: TOKEN,
    reference: "TEST1234",
    file: png(),
    ...overrides,
  };
}

describe("submitProof", () => {
  // The email templates read the public site URL to build links.
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("unknown token returns Order not found", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(input({ token: "nope" }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ error: "Order not found" });
    expect(fake.uploads).toHaveLength(0);
  });

  test("a cancelled order is refused", async () => {
    const fake = fakeRepo({ status: "cancelled" });
    const email = fakeEmail();
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ error: "This order was cancelled" });
    expect(fake.uploads).toHaveLength(0);
    expect(email.send).not.toHaveBeenCalled();
  });

  test("an order awaiting a quote is refused with the quote message", async () => {
    const fake = fakeRepo({ status: "awaiting_quote" });
    const email = fakeEmail();
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ error: "We'll email your total before you pay." });
    expect(fake.uploads).toHaveLength(0);
    expect(fake.upserts).toHaveLength(0);
  });

  test("a proof after the payment is confirmed is refused", async () => {
    const fake = fakeRepo({ status: "confirmed" });
    const email = fakeEmail();
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ error: "Your payment is already confirmed" });
    expect(fake.upserts).toHaveLength(0);
  });

  test("a file over 4 MB is rejected", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(input({ file: png(5 * MB) }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ error: FILE_ERROR });
    expect(fake.uploads).toHaveLength(0);
  });

  test("a file exactly 4 MB is accepted", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(input({ file: png(4 * MB) }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ ok: true });
  });

  test("a text file is rejected", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(
      input({ file: { name: "note.txt", type: "text/plain", size: 100, bytes: new ArrayBuffer(0) } }),
      { repo: fake.repo, email: email.deps, siteUrl: SITE },
    );
    expect(result).toEqual({ error: FILE_ERROR });
  });

  test.each(["image/heic", "image/heif", "application/pdf", "image/webp", "image/jpeg"])(
    "%s is accepted",
    async (type) => {
      const fake = fakeRepo();
      const email = fakeEmail();
      const result = await submitProof(
        input({ file: { name: "r", type, size: 100, bytes: new ArrayBuffer(0) } }),
        { repo: fake.repo, email: email.deps, siteUrl: SITE },
      );
      expect(result).toEqual({ ok: true });
    },
  );

  test("a reference shorter than 3 characters is rejected", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(input({ reference: "  ab  " }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({
      error: "Please enter the payment reference (3–64 characters)",
    });
    expect(fake.upserts).toHaveLength(0);
  });

  test("a reference longer than 64 characters is rejected", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(input({ reference: "x".repeat(65) }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({
      error: "Please enter the payment reference (3–64 characters)",
    });
  });

  test("the reference is optional: a blank reference is stored as null and the upload succeeds", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(input({ reference: "   " }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ ok: true });
    expect(fake.upserts[0].reference).toBeNull();
    expect(fake.payments[0].reference).toBeNull();
  });

  test("success moves the order to proof_submitted and stores the order total as the amount", async () => {
    const fake = fakeRepo({ total_cents: 64000 });
    const email = fakeEmail();
    const result = await submitProof(input({ reference: "  TEST1234  " }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });

    expect(result).toEqual({ ok: true });
    expect(fake.statuses).toEqual(["proof_submitted"]);
    expect(fake.upserts).toHaveLength(1);
    expect(fake.upserts[0]).toMatchObject({
      orderId: ORDER_ID,
      amountCents: 64000,
      reference: "TEST1234",
    });
    expect(fake.uploads[0].path).toMatch(new RegExp(`^${ORDER_ID}/payment-\\d+\\.png$`));
  });

  test("success sends the customer and staff emails", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    await submitProof(input(), { repo: fake.repo, email: email.deps, siteUrl: SITE });

    const logged = email.logs.map((entry) => [entry.template, entry.to_email]);
    expect(logged).toEqual([
      ["proof_received", "asha@example.test"],
      ["staff_proof_received", "staff@example.test"],
    ]);
    expect(email.send.mock.calls[0][0].subject).toBe("We received your payment proof for BS-0001");
    expect(email.send.mock.calls[1][0].subject).toBe("Payment proof to check for BS-0001");
    const staffHtml = email.send.mock.calls[1][0].html;
    expect(staffHtml).toContain(`https://shop.test/admin/orders/${ORDER_ID}`);
    expect(staffHtml).not.toContain("shop.test//admin");
  });

  test("no staff email when notify_email is not set", async () => {
    const fake = fakeRepo({}, { notify_email: null });
    const email = fakeEmail();
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ ok: true });
    expect(email.logs.map((entry) => entry.template)).toEqual(["proof_received"]);
  });

  test("an email failure is logged and does not fail the upload", async () => {
    const fake = fakeRepo();
    const email = fakeEmail(async () => {
      throw new Error("Brevo 500");
    });
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ ok: true });
    expect(fake.statuses).toEqual(["proof_submitted"]);
    expect(email.logs.every((entry) => entry.error === "Brevo 500")).toBe(true);
  });

  test("a second upload while the proof is still submitted replaces the pending row", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const deps = { repo: fake.repo, email: email.deps, siteUrl: SITE };

    await submitProof(input({ reference: "FIRST111" }), deps);
    const firstPath = fake.payments[0].receipt_path;

    const second = await submitProof(input({ reference: "SECOND22" }), deps);

    expect(second).toEqual({ ok: true });
    expect(fake.upserts).toHaveLength(2);
    const submitted = fake.payments.filter((row) => row.status === "submitted");
    expect(submitted).toHaveLength(1);
    expect(submitted[0].reference).toBe("SECOND22");
    expect(fake.deleted).toEqual([firstPath]);
    expect(fake.statuses).toEqual(["proof_submitted"]);
  });

  test("the status change is conditional on the status that was read", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    await submitProof(input(), { repo: fake.repo, email: email.deps, siteUrl: SITE });
    expect(fake.statusCalls).toEqual([["awaiting_payment", "proof_submitted"]]);
  });

  test("a concurrent cancel refuses the upload, asks for a refresh and writes nothing", async () => {
    const fake = fakeRepo();
    fake.statusMoves = false;
    const email = fakeEmail();
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ error: REFRESH_ERROR });
    // The status guard runs before anything is uploaded or written.
    expect(fake.uploads).toHaveLength(0);
    expect(fake.deleted).toEqual([]);
    expect(email.send).not.toHaveBeenCalled();
  });

  test("a payment settled in the meantime asks for a refresh, deletes the new receipt and puts the status back", async () => {
    const fake = fakeRepo();
    fake.upsertOutcome = "settled";
    const email = fakeEmail();
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ error: REFRESH_ERROR });
    expect(fake.deleted).toEqual([fake.uploads[0].path]);
    expect(fake.order?.status).toBe("awaiting_payment");
  });

  test("if the payment write throws, the new receipt is deleted, the status is put back and the error is rethrown", async () => {
    const fake = fakeRepo();
    fake.failUpsert = new Error("db unavailable");
    const email = fakeEmail();
    await expect(
      submitProof(input(), { repo: fake.repo, email: email.deps, siteUrl: SITE }),
    ).rejects.toThrow("db unavailable");
    expect(fake.deleted).toEqual([fake.uploads[0].path]);
    expect(fake.order?.status).toBe("awaiting_payment");
  });

  test("a HEIC file with a blank MIME type is accepted from its extension", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(
      input({ file: { name: "IMG_1.HEIC", type: "", size: 100, bytes: new ArrayBuffer(0) } }),
      { repo: fake.repo, email: email.deps, siteUrl: SITE },
    );
    expect(result).toEqual({ ok: true });
    expect(fake.uploads[0].path).toMatch(/\/payment-\d+\.heic$/);
    expect(fake.uploads[0].file.type).toBe("image/heic");
  });

  test("a blank MIME type with a non-receipt extension is rejected", async () => {
    const fake = fakeRepo();
    const email = fakeEmail();
    const result = await submitProof(
      input({ file: { name: "x.exe", type: "", size: 100, bytes: new ArrayBuffer(0) } }),
      { repo: fake.repo, email: email.deps, siteUrl: SITE },
    );
    expect(result).toEqual({ error: FILE_ERROR });
    expect(fake.uploads).toHaveLength(0);
  });

  test("a re-upload in proof_submitted still succeeds when nothing races", async () => {
    const fake = fakeRepo({
      status: "proof_submitted",
      payments: [
        {
          id: "pay-old",
          status: "submitted",
          amount_cents: TOTAL,
          reference: "OLD1111",
          receipt_path: "order/payment-old.png",
          reject_reason: null,
        },
      ],
    });
    const email = fakeEmail();
    const result = await submitProof(input({ reference: "NEW2222" }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ ok: true });
    expect(fake.statusCalls).toEqual([["proof_submitted", "proof_submitted"]]);
    expect(fake.statuses).toEqual([]);
    expect(fake.payments).toHaveLength(1);
    expect(fake.payments[0].reference).toBe("NEW2222");
    expect(fake.deleted).toEqual(["order/payment-old.png"]);
  });

  test("a confirm that lands between the status check and the write leaves no stray pending row and keeps the confirmed receipt", async () => {
    const fake = fakeRepo({
      status: "proof_submitted",
      payments: [
        {
          id: "pay-old",
          status: "submitted",
          amount_cents: TOTAL,
          reference: "OLD1111",
          receipt_path: "order/payment-old.png",
          reject_reason: null,
        },
      ],
    });
    // Staff confirm the payment while the customer's new file is being written.
    fake.beforeWrite = () => {
      const row = fake.payments.find((p) => p.id === "pay-old");
      if (row) row.status = "confirmed";
      if (fake.order) fake.order.status = "confirmed";
    };
    const email = fakeEmail();
    const result = await submitProof(input({ reference: "NEW2222" }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });

    expect(result).toEqual({ error: REFRESH_ERROR });
    expect(fake.deletedPendingIds).toHaveLength(1);
    expect(fake.payments.filter((p) => p.status === "submitted")).toHaveLength(0);
    expect(fake.payments.find((p) => p.id === "pay-old")?.status).toBe("confirmed");
    expect(fake.deleted).toContain(fake.uploads[0].path);
    expect(fake.deleted).not.toContain("order/payment-old.png");
    expect(email.send).not.toHaveBeenCalled();
  });

  test("an insert never deletes an old receipt, including an earlier rejected one", async () => {
    const fake = fakeRepo({
      payments: [
        {
          id: "pay-rejected",
          status: "rejected",
          amount_cents: TOTAL,
          reference: "BAD1111",
          receipt_path: "order/payment-rejected.png",
          reject_reason: "Amount does not match",
        },
      ],
    });
    const email = fakeEmail();
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ ok: true });
    expect(fake.deleted).toEqual([]);
    expect(fake.payments.find((p) => p.id === "pay-rejected")?.receipt_path).toBe(
      "order/payment-rejected.png",
    );
  });

  test("an insert that staff settle between the write and the re-check is kept: ok, no receipt deleted", async () => {
    const fake = fakeRepo();
    // Staff confirm the freshly inserted row (and move the order) right after the write.
    fake.afterWrite = () => {
      const row = fake.payments.find((p) => p.status === "submitted");
      if (row) row.status = "confirmed";
      if (fake.order) fake.order.status = "confirmed";
    };
    const email = fakeEmail();
    const result = await submitProof(input(), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ ok: true });
    expect(fake.deletedPendingIds).toHaveLength(1);
    expect(fake.deleted).toEqual([]);
    expect(fake.payments).toHaveLength(1);
    expect(fake.payments[0].status).toBe("confirmed");
  });

  test("an update followed by a status change is accepted: no undo, the earlier row survives, only the replaced receipt goes", async () => {
    const fake = fakeRepo({
      status: "proof_submitted",
      payments: [
        {
          id: "pay-old",
          status: "submitted",
          amount_cents: TOTAL,
          reference: "OLD1111",
          receipt_path: "order/payment-old.png",
          reject_reason: null,
        },
      ],
    });
    // The order moves on after the customer's own pending row was replaced.
    fake.afterWrite = () => {
      if (fake.order) fake.order.status = "confirmed";
    };
    const email = fakeEmail();
    const result = await submitProof(input({ reference: "NEW2222" }), {
      repo: fake.repo,
      email: email.deps,
      siteUrl: SITE,
    });
    expect(result).toEqual({ ok: true });
    expect(fake.deletedPendingIds).toEqual([]);
    expect(fake.payments).toHaveLength(1);
    expect(fake.payments[0]).toMatchObject({
      id: "pay-old",
      status: "submitted",
      reference: "NEW2222",
      receipt_path: fake.uploads[0].path,
    });
    expect(fake.deleted).toEqual(["order/payment-old.png"]);
    expect(fake.statusCalls).toEqual([["proof_submitted", "proof_submitted"]]);
    expect(email.logs.map((entry) => entry.template)).toEqual([
      "proof_received",
      "staff_proof_received",
    ]);
  });
});
