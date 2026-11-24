import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cancelOrder,
  changeDate,
  markCompleted,
  markReady,
  requestProofAgain,
  setDeliveryFee,
  type AdminOrder,
  type AdminOrderRepo,
  type OrderActionDeps,
} from "@/lib/admin/order-actions";
import type { EmailDeps, EmailLogEntry } from "@/lib/email/types";
import { formatFulfilDate } from "@/lib/format-date";
import type { OrderStatus } from "@/lib/order-status";
import type { BankDetails } from "@/lib/types";

const NOW = new Date("2026-11-24T14:00:00Z");
const ORDER_ID = "00000000-0000-0000-0000-00000000b0b0";
const STAFF_ID = "00000000-0000-0000-0000-0000000005a5";
const REFRESH_ERROR = "Order was updated — refresh";
const FEE_ERROR = "Enter a fee between TT$0 and TT$1,000";
const REASON_ERROR = "Please give a reason (3–300 characters)";
const SAME_DATE_ERROR = "That's already the order date.";
const BANK: BankDetails = {
  bank: "Republic Bank",
  account_name: "Butter & Scotch Ltd",
  account_type: "Savings",
  transit: "00123",
  account_no_same_bank: "1234567",
  account_no_other_bank: "7654321",
};
const PICKUP_INFO = "Collect from the shop, 10am to 4pm.";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

type SentMail = { to: string; subject: string; html: string };

type State = {
  order: AdminOrder;
  windowStartedAt: string | null;
  events: { kind: string; detail: Record<string, unknown>; staffId: string }[];
  rpcCalls: { orderId: string; newDate: string; overrideCap: boolean }[];
  /** Message the date RPC raises, as the database exception text. */
  rpcError: string | null;
  /** Runs at the start of the date RPC: simulates another move landing first. */
  raceBeforeRpc: (() => void) | null;
  /** Runs inside updateOrder, before its status check: simulates a concurrent staff action. */
  raceBeforeUpdate: (() => void) | null;
  updateThrows: boolean;
  /** Whether the order has a payment row still in `submitted`. */
  submittedPayment: boolean;
  reminderSentAt: string | null;
};

function baseOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: ORDER_ID,
    orderNumber: "BS-0142",
    accessToken: "tok_abc123",
    customerName: "Asha Mohan",
    email: "asha@example.test",
    status: "awaiting_quote",
    fulfilment: "delivery",
    fulfilDate: "2026-11-28",
    subtotalCents: 7800,
    adjustmentsCents: 0,
    deliveryFeeCents: null,
    totalCents: 7800,
    ...overrides,
  };
}

function freshState(status: OrderStatus = "awaiting_quote", overrides: Partial<AdminOrder> = {}): State {
  return {
    order: baseOrder({ status, ...overrides }),
    windowStartedAt: null,
    events: [],
    rpcCalls: [],
    rpcError: null,
    raceBeforeRpc: null,
    raceBeforeUpdate: null,
    updateThrows: false,
    submittedPayment: false,
    reminderSentAt: "2026-11-23T09:00:00.000Z",
  };
}

function fakeRepo(state: State): AdminOrderRepo {
  return {
    async findOrder(orderId) {
      if (orderId !== state.order.id) return null;
      return { ...state.order };
    },
    async updateOrder(orderId, expectStatus, set) {
      state.raceBeforeUpdate?.();
      if (state.updateThrows) throw new Error("connection reset");
      if (orderId !== state.order.id || state.order.status !== expectStatus) return false;
      state.order.status = set.status;
      if (set.deliveryFeeCents !== undefined) state.order.deliveryFeeCents = set.deliveryFeeCents;
      if (set.totalCents !== undefined) state.order.totalCents = set.totalCents;
      if (set.paymentWindowStartedAt !== undefined) {
        state.windowStartedAt = set.paymentWindowStartedAt;
        state.reminderSentAt = null;
      }
      return true;
    },
    async hasSubmittedPayment() {
      return state.submittedPayment;
    },
    async changeFulfilDate(orderId, newDate, overrideCap) {
      state.raceBeforeRpc?.();
      state.rpcCalls.push({ orderId, newDate, overrideCap });
      if (state.rpcError) throw new Error(state.rpcError);
      const oldDate = state.order.fulfilDate;
      state.order.fulfilDate = newDate;
      return oldDate;
    },
    async addEvent(_orderId, kind, detail, staffId) {
      state.events.push({ kind, detail, staffId });
    },
  };
}

function recordingEmail(options: { fail?: boolean } = {}) {
  const sent: SentMail[] = [];
  const logs: EmailLogEntry[] = [];
  const email: EmailDeps = {
    provider: {
      async send(msg) {
        if (options.fail) throw new Error("Brevo 500: upstream down");
        sent.push({ to: msg.to, subject: msg.subject, html: msg.html });
        return { id: `msg-${sent.length}` };
      },
    },
    async log(entry) {
      logs.push(entry);
    },
  };
  return { sent, logs, email };
}

function deps(state: State, email: EmailDeps): OrderActionDeps {
  return {
    repo: fakeRepo(state),
    email,
    staff: { userId: STAFF_ID },
    now: () => NOW,
    getBank: async () => BANK,
    getPickupInfo: async () => PICKUP_INFO,
  };
}

describe("setDeliveryFee", () => {
  test("sets the fee, the total, the status and the payment window, then emails the total", async () => {
    const state = freshState("awaiting_quote");
    const mail = recordingEmail();
    const result = await setDeliveryFee({ orderId: ORDER_ID, feeCents: 1200 }, deps(state, mail.email));

    expect(result).toEqual({ ok: true, emailFailed: false });
    expect(state.order.deliveryFeeCents).toBe(1200);
    expect(state.order.totalCents).toBe(9000);
    expect(state.order.status).toBe("awaiting_payment");
    expect(state.windowStartedAt).toBe(NOW.toISOString());
    expect(state.events).toEqual([
      { kind: "fee_set", detail: { deliveryFeeCents: 1200, totalCents: 9000 }, staffId: STAFF_ID },
    ]);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("asha@example.test");
    expect(mail.sent[0].subject).toBe("Your total for BS-0142 is ready — pay to confirm");
    expect(mail.sent[0].html).toContain(BANK.account_no_same_bank);
  });

  test("is refused when the order is not awaiting a quote", async () => {
    const state = freshState("confirmed");
    const mail = recordingEmail();
    const result = await setDeliveryFee({ orderId: ORDER_ID, feeCents: 1200 }, deps(state, mail.email));

    expect(result).toEqual({ error: "Can't set the fee on an order that is confirmed" });
    expect(state.order.status).toBe("confirmed");
    expect(state.events).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
  });

  test.each([-1, 100001, 12.5, Number.NaN])("refuses the fee %s", async (feeCents) => {
    const state = freshState("awaiting_quote");
    const mail = recordingEmail();
    const result = await setDeliveryFee({ orderId: ORDER_ID, feeCents }, deps(state, mail.email));

    expect(result).toEqual({ error: FEE_ERROR });
    expect(state.order.status).toBe("awaiting_quote");
  });

  test("reports emailFailed when the email does not go out, and keeps the saved fee", async () => {
    const state = freshState("awaiting_quote");
    const mail = recordingEmail({ fail: true });
    const result = await setDeliveryFee({ orderId: ORDER_ID, feeCents: 500 }, deps(state, mail.email));

    expect(result).toEqual({ ok: true, emailFailed: true });
    expect(state.order.status).toBe("awaiting_payment");
    expect(mail.logs[0].error).toContain("Brevo 500");
  });

  test("refreshes when a concurrent change moved the order first", async () => {
    const state = freshState("awaiting_quote");
    state.raceBeforeUpdate = () => {
      state.order.status = "cancelled";
    };
    const mail = recordingEmail();
    const result = await setDeliveryFee({ orderId: ORDER_ID, feeCents: 500 }, deps(state, mail.email));

    expect(result).toEqual({ error: REFRESH_ERROR });
    expect(state.events).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
  });
});

describe("changeDate", () => {
  const NEW_DATE = "2026-12-01";

  test("calls the RPC and emails the old and new dates on success", async () => {
    const state = freshState("confirmed");
    const mail = recordingEmail();
    const result = await changeDate(
      { orderId: ORDER_ID, newDate: NEW_DATE, overrideCap: true },
      deps(state, mail.email),
    );

    expect(result).toEqual({ ok: true, emailFailed: false });
    expect(state.rpcCalls).toEqual([{ orderId: ORDER_ID, newDate: NEW_DATE, overrideCap: true }]);
    expect(state.order.fulfilDate).toBe(NEW_DATE);
    expect(mail.sent[0].subject).toBe("New date for order BS-0142");
    expect(mail.sent[0].html).toContain(formatFulfilDate("2026-11-28"));
    expect(mail.sent[0].html).toContain(formatFulfilDate(NEW_DATE));
  });

  test("emails the old date the RPC read under its lock, not the one read before it", async () => {
    const state = freshState("confirmed");
    // Another staff member moves the order between this action's read and the RPC.
    state.raceBeforeRpc = () => {
      state.order.fulfilDate = "2026-12-05";
    };
    const mail = recordingEmail();
    const result = await changeDate(
      { orderId: ORDER_ID, newDate: NEW_DATE, overrideCap: true },
      deps(state, mail.email),
    );

    expect(result).toEqual({ ok: true, emailFailed: false });
    expect(mail.sent[0].html).toContain(formatFulfilDate("2026-12-05"));
    expect(mail.sent[0].html).not.toContain(formatFulfilDate("2026-11-28"));
  });

  test.each([
    ["date_blocked", "That date is blocked. Unblock it in Settings first."],
    ["date_full", "That day is full. Tick “Override daily limit” to add it anyway."],
    ["order_closed", "This order is closed."],
  ])("maps the %s RPC error to its message and sends no email", async (code, message) => {
    const state = freshState("confirmed");
    state.rpcError = `${code}`;
    const mail = recordingEmail();
    const result = await changeDate(
      { orderId: ORDER_ID, newDate: "2026-12-01", overrideCap: false },
      deps(state, mail.email),
    );

    expect(result).toEqual({ error: message });
    expect(state.order.fulfilDate).toBe("2026-11-28");
    expect(mail.sent).toHaveLength(0);
  });

  test("refuses the order's current date before calling the RPC", async () => {
    const state = freshState("confirmed");
    const mail = recordingEmail();
    const result = await changeDate(
      { orderId: ORDER_ID, newDate: "2026-11-28", overrideCap: false },
      deps(state, mail.email),
    );

    expect(result).toEqual({ error: SAME_DATE_ERROR });
    expect(state.rpcCalls).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
  });

  test("refuses a date in the past in Trinidad time", async () => {
    const state = freshState("confirmed");
    const mail = recordingEmail();
    const result = await changeDate(
      { orderId: ORDER_ID, newDate: "2026-11-23", overrideCap: false },
      deps(state, mail.email),
    );

    expect(result).toEqual({ error: "Pick today or a later date" });
    expect(state.rpcCalls).toHaveLength(0);
  });

  test("refuses a date that is not a real ISO date", async () => {
    const state = freshState("confirmed");
    const mail = recordingEmail();
    const result = await changeDate(
      { orderId: ORDER_ID, newDate: "2026-02-30", overrideCap: false },
      deps(state, mail.email),
    );

    expect(result).toEqual({ error: "Pick a valid date" });
    expect(state.rpcCalls).toHaveLength(0);
  });
});

describe("markReady", () => {
  test("is refused on an order awaiting payment, with the nextStatus message", async () => {
    const state = freshState("awaiting_payment");
    const mail = recordingEmail();
    const result = await markReady({ orderId: ORDER_ID, notify: true }, deps(state, mail.email));

    expect(result).toEqual({
      error: "Can't mark ready an order that is awaiting payment — not confirmed",
    });
    expect(state.order.status).toBe("awaiting_payment");
  });

  test("moves a confirmed order to ready and sends nothing when notify is false", async () => {
    const state = freshState("confirmed");
    const mail = recordingEmail();
    const result = await markReady({ orderId: ORDER_ID, notify: false }, deps(state, mail.email));

    expect(result).toEqual({ ok: true });
    expect(state.order.status).toBe("ready");
    expect(state.events[0]).toMatchObject({ kind: "marked_ready", detail: { notify: false } });
    expect(mail.sent).toHaveLength(0);
  });

  test("emails the pickup instructions for a pickup order when notify is true", async () => {
    const state = freshState("confirmed", { fulfilment: "pickup" });
    const mail = recordingEmail();
    const result = await markReady({ orderId: ORDER_ID, notify: true }, deps(state, mail.email));

    expect(result).toEqual({ ok: true, emailFailed: false });
    expect(state.order.status).toBe("ready");
    expect(mail.sent[0].subject).toBe("Order BS-0142 is ready for pickup");
    expect(mail.sent[0].html).toContain("Collect from the shop");
  });
});

describe("markCompleted", () => {
  test("completes a confirmed order with an event and no email", async () => {
    const state = freshState("confirmed");
    const mail = recordingEmail();
    const result = await markCompleted({ orderId: ORDER_ID }, deps(state, mail.email));

    expect(result).toEqual({ ok: true });
    expect(state.order.status).toBe("completed");
    expect(state.events[0]).toMatchObject({ kind: "completed", staffId: STAFF_ID });
    expect(mail.sent).toHaveLength(0);
  });

  test("completes a ready order", async () => {
    const state = freshState("ready");
    const mail = recordingEmail();
    const result = await markCompleted({ orderId: ORDER_ID }, deps(state, mail.email));

    expect(result).toEqual({ ok: true });
    expect(state.order.status).toBe("completed");
  });

  test("reports a clear error when the write throws", async () => {
    const state = freshState("confirmed");
    state.updateThrows = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mail = recordingEmail();
    const result = await markCompleted({ orderId: ORDER_ID }, deps(state, mail.email));
    spy.mockRestore();

    expect(result).toEqual({ error: "Couldn't save the change — try again" });
    expect(state.events).toHaveLength(0);
  });
});

describe("cancelOrder", () => {
  test("needs a reason of 3 to 300 characters once trimmed", async () => {
    for (const reason of ["", "   ", "ab", "x".repeat(301)]) {
      const state = freshState("confirmed");
      const mail = recordingEmail();
      const result = await cancelOrder({ orderId: ORDER_ID, reason }, deps(state, mail.email));
      expect(result).toEqual({ error: REASON_ERROR });
      expect(state.order.status).toBe("confirmed");
    }
  });

  test("cancels, records the trimmed reason and emails the customer", async () => {
    const state = freshState("awaiting_payment");
    const mail = recordingEmail();
    const result = await cancelOrder(
      { orderId: ORDER_ID, reason: "  Sold out of cookies  " },
      deps(state, mail.email),
    );

    expect(result).toEqual({ ok: true, emailFailed: false });
    expect(state.order.status).toBe("cancelled");
    expect(state.events[0]).toMatchObject({ kind: "cancelled", detail: { reason: "Sold out of cookies" } });
    expect(mail.sent[0].subject).toBe("Order BS-0142 cancelled");
  });

  test("is refused on a completed order", async () => {
    const state = freshState("completed");
    const mail = recordingEmail();
    const result = await cancelOrder({ orderId: ORDER_ID, reason: "Changed my mind" }, deps(state, mail.email));

    expect(result).toEqual({ error: "Can't cancel an order that is completed" });
    expect(state.order.status).toBe("completed");
    expect(mail.sent).toHaveLength(0);
  });

  test("refreshes when a concurrent change moved the order first", async () => {
    const state = freshState("confirmed");
    state.raceBeforeUpdate = () => {
      state.order.status = "completed";
    };
    const mail = recordingEmail();
    const result = await cancelOrder({ orderId: ORDER_ID, reason: "Changed my mind" }, deps(state, mail.email));

    expect(result).toEqual({ error: REFRESH_ERROR });
    expect(mail.sent).toHaveLength(0);
  });
});

describe("requestProofAgain", () => {
  const PROOF_AGAIN_REASON = "We couldn't find your payment proof — please upload it again.";

  test("reopens payment for a stuck order, clears the reminder, records an event and emails the reason", async () => {
    const state = freshState("proof_submitted");
    const mail = recordingEmail();
    const result = await requestProofAgain({ orderId: ORDER_ID }, deps(state, mail.email));

    expect(result).toEqual({ ok: true, emailFailed: false });
    expect(state.order.status).toBe("awaiting_payment");
    expect(state.windowStartedAt).toBe(NOW.toISOString());
    expect(state.reminderSentAt).toBeNull();
    expect(state.events).toEqual([
      { kind: "proof_requested_again", detail: { reason: PROOF_AGAIN_REASON }, staffId: STAFF_ID },
    ]);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].subject).toBe("Action needed: payment proof for BS-0142");
    expect(mail.sent[0].html).toContain("find your payment proof — please upload it again.");
  });

  test("is refused when a submitted proof is waiting to be reviewed", async () => {
    const state = freshState("proof_submitted");
    state.submittedPayment = true;
    const mail = recordingEmail();
    const result = await requestProofAgain({ orderId: ORDER_ID }, deps(state, mail.email));

    expect(result).toEqual({ error: "This order has a proof to review — use Confirm or Reject." });
    expect(state.order.status).toBe("proof_submitted");
    expect(state.events).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
  });

  test("is refused when the order is not waiting for a proof", async () => {
    const state = freshState("awaiting_payment");
    const mail = recordingEmail();
    const result = await requestProofAgain({ orderId: ORDER_ID }, deps(state, mail.email));

    expect(result).toEqual({ error: "Can't ask for proof again on an order that is awaiting payment — not confirmed" });
    expect(state.order.status).toBe("awaiting_payment");
    expect(mail.sent).toHaveLength(0);
  });

  test("refreshes when a concurrent change moved the order first", async () => {
    const state = freshState("proof_submitted");
    state.raceBeforeUpdate = () => {
      state.order.status = "cancelled";
    };
    const mail = recordingEmail();
    const result = await requestProofAgain({ orderId: ORDER_ID }, deps(state, mail.email));

    expect(result).toEqual({ error: REFRESH_ERROR });
    expect(state.events).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
  });
});
