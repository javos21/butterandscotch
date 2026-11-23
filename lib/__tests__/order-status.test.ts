import { describe, expect, test } from "vitest";
import {
  ORDER_STATUSES,
  OrderStateError,
  STATUS_LABEL,
  afterProofSubmitted,
  countsTowardCap,
  paymentOpen,
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
      "awaiting_quote",
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
    expect(countsTowardCap("awaiting_quote")).toBe(true);
  });
});

describe("paymentOpen", () => {
  test("payment is open while awaiting payment", () => {
    expect(paymentOpen("awaiting_payment")).toBe(true);
  });
  test("payment is not open while awaiting a quote", () => {
    expect(paymentOpen("awaiting_quote")).toBe(false);
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
