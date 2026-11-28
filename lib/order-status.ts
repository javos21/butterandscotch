export type OrderStatus =
  | "awaiting_payment"
  | "proof_submitted"
  | "confirmed"
  | "ready"
  | "completed"
  | "cancelled";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "awaiting_payment",
  "proof_submitted",
  "confirmed",
  "ready",
  "completed",
  "cancelled",
] as const;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment — not confirmed",
  proof_submitted: "Payment being checked",
  confirmed: "Confirmed",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export class OrderStateError extends Error {}

/** Reads a status string from the database. Throws for any value that is not a current status. */
export function parseStatus(value: string): OrderStatus {
  if ((ORDER_STATUSES as readonly string[]).includes(value)) return value as OrderStatus;
  throw new OrderStateError(`Unknown order status: ${value}`);
}

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

/** Actions staff can take on an order. Customer actions are handled elsewhere. */
export type StaffAction =
  | "confirm_proof"
  | "reject_proof"
  | "mark_ready"
  | "mark_completed"
  | "cancel";

const STAFF_ACTION_VERB: Record<StaffAction, string> = {
  confirm_proof: "confirm proof on",
  reject_proof: "reject proof on",
  mark_ready: "mark ready",
  mark_completed: "mark completed",
  cancel: "cancel",
};

const STAFF_TRANSITIONS: Partial<Record<StaffAction, Partial<Record<OrderStatus, OrderStatus>>>> = {
  confirm_proof: { proof_submitted: "confirmed" },
  reject_proof: { proof_submitted: "awaiting_payment" },
  mark_ready: { confirmed: "ready" },
  mark_completed: { ready: "completed", confirmed: "completed" },
};

/** The status an order moves to when staff take an action. Throws OrderStateError if not allowed. */
export function nextStatus(from: OrderStatus, action: StaffAction): OrderStatus {
  let to: OrderStatus | undefined;
  if (action === "cancel") {
    if (from !== "completed" && from !== "cancelled") to = "cancelled";
  } else {
    to = STAFF_TRANSITIONS[action]?.[from];
  }
  if (to) return to;
  throw new OrderStateError(
    `Can't ${STAFF_ACTION_VERB[action]} an order that is ${STATUS_LABEL[from].toLowerCase()}`,
  );
}
