import { describe, expect, test } from "vitest";
import {
  ORDER_STATUSES,
  OrderStateError,
  STATUS_LABEL,
  parseStatus,
  afterProofSubmitted,
  countsTowardCap,
  nextStatus,
  paymentOpen,
  type OrderStatus,
  type StaffAction,
} from "@/lib/order-status";

describe("afterProofSubmitted", () => {
  test("proof moves awaiting_payment to proof_submitted", () => {
    expect(afterProofSubmitted("awaiting_payment")).toBe("proof_submitted");
  });
  test("replacing a proof keeps proof_submitted", () => {
    expect(afterProofSubmitted("proof_submitted")).toBe("proof_submitted");
  });
  test("other statuses cannot take a proof", () => {
    for (const s of [
      "confirmed",
      "ready",
      "completed",
      "cancelled",
    ] as const) {
      expect(() => afterProofSubmitted(s)).toThrow(OrderStateError);
    }
  });
});

describe("countsTowardCap", () => {
  test("cancelled orders do not count", () => {
    expect(countsTowardCap("cancelled")).toBe(false);
  });
  test("open orders count", () => {
    expect(countsTowardCap("awaiting_payment")).toBe(true);
  });
});

describe("paymentOpen", () => {
  test("payment is open while awaiting payment", () => {
    expect(paymentOpen("awaiting_payment")).toBe(true);
  });
  test("payment is not open once proof has been sent", () => {
    expect(paymentOpen("proof_submitted")).toBe(false);
  });
});

describe("parseStatus", () => {
  test("accepts every current status", () => {
    for (const status of ORDER_STATUSES) {
      expect(parseStatus(status)).toBe(status);
    }
  });
  test("refuses the removed awaiting_quote status", () => {
    expect(() => parseStatus("awaiting_quote")).toThrow(OrderStateError);
  });
  test("refuses an unknown status", () => {
    expect(() => parseStatus("nonsense")).toThrow(OrderStateError);
  });
});

describe("labels and statuses", () => {
  test("STATUS_LABEL covers every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(STATUS_LABEL[status]).toBeTruthy();
    }
    expect(STATUS_LABEL.awaiting_payment).toBe(
      "Awaiting payment — not confirmed",
    );
    expect(STATUS_LABEL.confirmed).toBe("Confirmed");
  });
});

describe("nextStatus", () => {
  const allowed: Array<[OrderStatus, StaffAction, OrderStatus]> = [
    ["proof_submitted", "confirm_proof", "confirmed"],
    ["proof_submitted", "reject_proof", "awaiting_payment"],
    ["confirmed", "mark_ready", "ready"],
    ["ready", "mark_completed", "completed"],
    ["confirmed", "mark_completed", "completed"],
  ];

  const cancellable: OrderStatus[] = [
    "awaiting_payment",
    "proof_submitted",
    "confirmed",
    "ready",
  ];

  const actions: StaffAction[] = [
    "confirm_proof",
    "reject_proof",
    "mark_ready",
    "mark_completed",
    "cancel",
  ];

  test("every (status, action) pair follows the transition table", () => {
    for (const from of ORDER_STATUSES) {
      for (const action of actions) {
        const expected = allowed.find(([s, a]) => s === from && a === action);
        const cancelOk = action === "cancel" && cancellable.includes(from);
        if (expected) {
          expect(nextStatus(from, action)).toBe(expected[2]);
        } else if (cancelOk) {
          expect(nextStatus(from, action)).toBe("cancelled");
        } else {
          expect(() => nextStatus(from, action)).toThrow(OrderStateError);
        }
      }
    }
  });

  test("refusal message names the action and the current status", () => {
    expect(() => nextStatus("completed", "cancel")).toThrow(
      "Can't cancel an order that is completed",
    );
    expect(() => nextStatus("completed", "mark_ready")).toThrow(
      "Can't mark ready an order that is completed",
    );
  });
});
