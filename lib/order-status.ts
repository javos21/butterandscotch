export type OrderStatus =
  | "awaiting_quote"
  | "awaiting_payment"
  | "proof_submitted"
  | "confirmed"
  | "ready"
  | "completed"
  | "cancelled";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "awaiting_quote",
  "awaiting_payment",
  "proof_submitted",
  "confirmed",
  "ready",
  "completed",
  "cancelled",
] as const;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_quote: "Awaiting delivery quote",
  awaiting_payment: "Awaiting payment — not confirmed",
  proof_submitted: "Payment being checked",
  confirmed: "Confirmed",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export class OrderStateError extends Error {}

/** A customer uploads (or replaces) payment proof. Only allowed while awaiting payment. */
export function afterProofSubmitted(s: OrderStatus): OrderStatus {
  if (s === "awaiting_payment" || s === "proof_submitted") return "proof_submitted";
  throw new OrderStateError(
    `Cannot submit payment proof while ${STATUS_LABEL[s].toLowerCase()}`,
  );
}

/** Whether an order takes up a slot against the daily cap. Cancelled orders free their slot. */
export function countsTowardCap(s: OrderStatus): boolean {
  return s !== "cancelled";
}

/** Whether the customer can still be asked to pay. */
export function paymentOpen(s: OrderStatus): boolean {
  return s === "awaiting_payment";
}
