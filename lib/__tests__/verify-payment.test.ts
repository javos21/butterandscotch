import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  verifyPayment,
  type PaymentRecord,
  type PaymentReviewRepo,
  type ReviewOrder,
  type VerifyPaymentDeps,
} from "@/lib/admin/verify-payment";
import type { EmailDeps, EmailLogEntry } from "@/lib/email/types";

const NOW = new Date("2026-11-24T14:00:00Z");
const ORDER_ID = "00000000-0000-0000-0000-00000000b0b0";
const PAYMENT_ID = "00000000-0000-0000-0000-0000000000a1";
const STAFF_ID = "00000000-0000-0000-0000-0000000005a5";
const REFRESH_ERROR = "Order was updated — refresh";
const ALREADY = "This payment was already reviewed";
const PROOF_CHANGED = "The customer uploaded a new proof — refresh and check again";
const RECEIPT_FILE = "Butter-and-Scotch-receipt-BS-0142.pdf";

type SentMail = {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
};

type State = {
  payment: PaymentRecord;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  order: ReviewOrder;
  windowStartedAt: string | null;
  reminderSentAt: string | null;
  events: { kind: string; detail: Record<string, unknown> }[];
  /** Runs inside moveOrder, before its status check: simulates a concurrent staff action. */
  raceBeforeMove: (() => void) | null;
};

function freshState(overrides: Partial<State> = {}): State {
  return {
    payment: {
      id: PAYMENT_ID,
      orderId: ORDER_ID,
      status: "submitted",
      reference: "FT-88213",
      receiptPath: `${ORDER_ID}/payment-1.jpg`,
    },
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: null,
    order: {
      id: ORDER_ID,
      orderNumber: "BS-0142",
      accessToken: "tok_abc123",
      customerName: "Asha Mohan",
      email: "asha@example.test",
      status: "proof_submitted",
      fulfilment: "pickup",
      fulfilDate: "2026-11-28",
      areaName: null,
      deliveryFeeCents: null,
      adjustmentsCents: 0,
      totalCents: 7800,
      items: [
        { name: "Red Velvet Cupcakes", flavour: null, quantity: 6, unitPriceCents: 1000 },
        { name: "Mini Cookie Bag", flavour: "Half & Half", quantity: 1, unitPriceCents: 1800 },
      ],
    },
    windowStartedAt: null,
    reminderSentAt: "2026-11-23T09:00:00Z",
    events: [],
    raceBeforeMove: null,
    ...overrides,
  };
}

function fakeRepo(state: State): PaymentReviewRepo {
  return {
    async findPayment(paymentId) {
      if (paymentId !== state.payment.id) return null;
      return { ...state.payment };
    },
    async updatePayment(paymentId, expect, set) {
      const p = state.payment;
      if (
        paymentId !== p.id ||
        p.status !== expect.status ||
        p.reference !== expect.reference ||
        p.receiptPath !== expect.receiptPath
      ) {
        return false;
      }
      p.status = set.status;
      state.reviewedBy = set.reviewedBy;
      state.reviewedAt = set.reviewedAt;
      state.rejectReason = set.rejectReason;
      return true;
    },
    async findOrder(orderId) {
      if (orderId !== state.order.id) return null;
      return { ...state.order, items: state.order.items.map((item) => ({ ...item })) };
    },
    async moveOrder(orderId, from, to, windowStart) {
      state.raceBeforeMove?.();
      if (orderId !== state.order.id || state.order.status !== from) return false;
      state.order.status = to;
      if (windowStart !== null) {
        state.windowStartedAt = windowStart;
        state.reminderSentAt = null;
      }
      return true;
    },
    async addEvent(_orderId, kind, detail) {
      state.events.push({ kind, detail });
    },
    async getWhatsappNumber() {
      return "+1 868 555 0100";
    },
  };
}

function recordingEmail() {
  const sent: SentMail[] = [];
  const logs: EmailLogEntry[] = [];
  const email: EmailDeps = {
    provider: {
      async send(msg) {
        sent.push(msg);
        return { id: `msg-${sent.length}` };
      },
    },
    async log(entry) {
      logs.push(entry);
    },
  };
  return { sent, logs, email };
}

async function renderPdfStub(): Promise<Buffer> {
  return Buffer.from("%PDF-1.4 stub " + "x".repeat(2000));
}

function setup(stateOverrides: Partial<State> = {}, depOverrides: Partial<VerifyPaymentDeps> = {}) {
  const state = freshState(stateOverrides);
  const mail = recordingEmail();
  const deps: VerifyPaymentDeps = {
    repo: fakeRepo(state),
    email: mail.email,
    staff: { userId: STAFF_ID },
    now: () => NOW,
    renderPdf: renderPdfStub,
    ...depOverrides,
  };
  const shown = { receiptPath: `${ORDER_ID}/payment-1.jpg`, reference: "FT-88213" };
  return { state, mail, deps, shown };
}

describe("verifyPayment", () => {
  beforeEach(() => {
    // The email templates build links from the site URL.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("confirm moves order to confirmed and emails a receipt", async () => {
    const { state, mail, deps, shown } = setup();

    const result = await verifyPayment({ paymentId: PAYMENT_ID, decision: "confirm", shown }, deps);

    expect(result).toEqual({ ok: true, emailFailed: false });
    expect(state.payment.status).toBe("confirmed");
    expect(state.reviewedBy).toBe(STAFF_ID);
    expect(state.order.status).toBe("confirmed");
    expect(state.events.map((e) => e.kind)).toContain("payment_confirmed");
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].subject).toBe("Order BS-0142 confirmed — receipt attached");
    expect(mail.sent[0].attachments).toHaveLength(1);
    expect(mail.sent[0].attachments?.[0].filename).toBe(RECEIPT_FILE);
  });

  test("reject needs a reason", async () => {
    const { state, mail, deps, shown } = setup();

    const result = await verifyPayment(
      { paymentId: PAYMENT_ID, decision: "reject", reason: "  no  ", shown },
      deps,
    );

    expect(result).toEqual({ error: "Please give a reason (3–300 characters)" });
    expect(state.payment.status).toBe("submitted");
    expect(state.order.status).toBe("proof_submitted");
    expect(mail.sent).toHaveLength(0);
  });

  test("reject restarts the payment window", async () => {
    const { state, mail, deps, shown } = setup();

    const result = await verifyPayment(
      {
        paymentId: PAYMENT_ID,
        decision: "reject",
        reason: "Amount does not match the bank statement",
        shown,
      },
      deps,
    );

    expect(result).toEqual({ ok: true, emailFailed: false });
    expect(state.payment.status).toBe("rejected");
    expect(state.rejectReason).toBe("Amount does not match the bank statement");
    expect(state.order.status).toBe("awaiting_payment");
    expect(state.windowStartedAt).toBe(NOW.toISOString());
    expect(state.reminderSentAt).toBeNull();
    expect(state.events.map((e) => e.kind)).toContain("payment_rejected");
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].subject).toBe("Action needed: payment proof for BS-0142");
    expect(mail.sent[0].html).toContain("Amount does not match the bank statement");
  });

  test("second confirm is refused", async () => {
    const { mail, deps, shown } = setup();
    const input = { paymentId: PAYMENT_ID, decision: "confirm" as const, shown };

    expect(await verifyPayment(input, deps)).toEqual({ ok: true, emailFailed: false });
    expect(await verifyPayment(input, deps)).toEqual({ error: ALREADY });
    expect(mail.sent).toHaveLength(1);
  });

  test("new upload during review", async () => {
    const { state, mail, deps } = setup();

    const result = await verifyPayment(
      {
        paymentId: PAYMENT_ID,
        decision: "confirm",
        shown: { receiptPath: `${ORDER_ID}/payment-0.jpg`, reference: "FT-88213" },
      },
      deps,
    );

    expect(result).toEqual({ error: PROOF_CHANGED });
    expect(state.payment.status).toBe("submitted");
    expect(state.order.status).toBe("proof_submitted");
    expect(mail.sent).toHaveLength(0);
  });

  test("order moved meanwhile", async () => {
    const { state, mail, deps, shown } = setup({
      raceBeforeMove: () => {
        state.order.status = "cancelled";
      },
    });

    const result = await verifyPayment({ paymentId: PAYMENT_ID, decision: "confirm", shown }, deps);

    expect(result).toEqual({ error: REFRESH_ERROR });
    expect(state.payment.status).toBe("submitted");
    expect(state.reviewedBy).toBeNull();
    expect(mail.sent).toHaveLength(0);
  });

  test("order write throws → payment restored, no email", async () => {
    const { state, mail, deps, shown } = setup({
      raceBeforeMove: () => {
        throw new Error("connection reset");
      },
    });

    const result = await verifyPayment({ paymentId: PAYMENT_ID, decision: "confirm", shown }, deps);

    expect(result).toEqual({ error: REFRESH_ERROR });
    expect(state.payment.status).toBe("submitted");
    expect(state.reviewedBy).toBeNull();
    expect(state.order.status).toBe("proof_submitted");
    expect(mail.sent).toHaveLength(0);
  });

  test("pdf failure still confirms", async () => {
    const { state, mail, deps, shown } = setup(
      {},
      {
        renderPdf: async () => {
          throw new Error("font missing");
        },
      },
    );

    const result = await verifyPayment({ paymentId: PAYMENT_ID, decision: "confirm", shown }, deps);

    expect(result).toEqual({ ok: true, emailFailed: true });
    expect(state.order.status).toBe("confirmed");
    expect(state.payment.status).toBe("confirmed");
    expect(mail.sent).toHaveLength(0);
    expect(mail.logs).toEqual([
      {
        order_id: ORDER_ID,
        template: "order_confirmed",
        to_email: "asha@example.test",
        provider_id: null,
        error: "receipt render failed: font missing",
      },
    ]);
  });
});
