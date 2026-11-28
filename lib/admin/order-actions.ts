import { sendTemplate, type EmailDeps } from "@/lib/email/send";
import { isIsoDate, trinidadToday } from "@/lib/dates";
import { nextStatus, OrderStateError, STATUS_LABEL, type OrderStatus, type StaffAction } from "@/lib/order-status";
import type { BankDetails } from "@/lib/types";

const ORDER_NOT_FOUND = "Order not found";
const REFRESH_ERROR = "Order was updated — refresh";
const SAVE_ERROR = "Couldn't save the change — try again";
const REASON_ERROR = "Please give a reason (3–300 characters)";
const REASON_MIN = 3;
const REASON_MAX = 300;
const DATE_ERROR = "Pick a valid date";
const PAST_DATE_ERROR = "Pick today or a later date";
const SAME_DATE_ERROR = "That's already the order date.";

/** Exception text raised by staff_change_fulfil_date, mapped to the message staff see. */
const DATE_RPC_ERRORS: Record<string, string> = {
  date_blocked: "That date is blocked. Unblock it in Settings first.",
  date_full: "That day is full. Tick “Override daily limit” to add it anyway.",
  order_closed: "This order is closed.",
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  accessToken: string;
  customerName: string;
  email: string;
  status: OrderStatus;
  fulfilment: "pickup" | "delivery";
  /** ISO "YYYY-MM-DD" business date. */
  fulfilDate: string;
  subtotalCents: number;
  adjustmentsCents: number;
  totalCents: number;
};

export type OrderUpdate = {
  status: OrderStatus;
  totalCents?: number;
  /** Restarts the payment window and clears the payment reminder. */
  paymentWindowStartedAt?: string;
};

/**
 * Persistence for staff order actions. Production wiring: lib/admin/orders-repo.ts.
 * updateOrder is conditional: it applies only while the order still holds expectStatus.
 */
export type AdminOrderRepo = {
  findOrder(orderId: string): Promise<AdminOrder | null>;
  updateOrder(orderId: string, expectStatus: OrderStatus, set: OrderUpdate): Promise<boolean>;
  /**
   * Calls staff_change_fulfil_date and returns the date the order held under the lock, "YYYY-MM-DD".
   * Throws with the database's exception text as the message.
   */
  changeFulfilDate(orderId: string, newDate: string, overrideCap: boolean): Promise<string>;
  /** True when the order has a payment row still in `submitted`. */
  hasSubmittedPayment(orderId: string): Promise<boolean>;
  addEvent(orderId: string, kind: string, detail: Record<string, unknown>, staffId: string): Promise<void>;
};

export type OrderActionDeps = {
  repo: AdminOrderRepo;
  email: EmailDeps;
  staff: { userId: string };
  now: () => Date;
  getBank: () => Promise<BankDetails>;
  getPickupInfo: () => Promise<string>;
  /** Production may defer emails; staff actions omit it and await the send so emailFailed is known. */
  defer?: (task: () => Promise<void>) => void;
};

export type OrderActionResult = { ok: true; emailFailed?: boolean } | { error: string };

export type ChangeDateInput = { orderId: string; newDate: string; overrideCap: boolean };
export type MarkReadyInput = { orderId: string; notify: boolean };
export type MarkCompletedInput = { orderId: string };
export type CancelOrderInput = { orderId: string; reason: string };

type Advanced = { order: AdminOrder; next: OrderStatus } | { error: string };

function customerBase(order: AdminOrder) {
  return { orderNumber: order.orderNumber, token: order.accessToken, customerName: order.customerName };
}

/** Loads the order and works out the status it moves to. */
async function advance(repo: AdminOrderRepo, orderId: string, action: StaffAction): Promise<Advanced> {
  const order = await repo.findOrder(orderId);
  if (!order) return { error: ORDER_NOT_FOUND };
  try {
    return { order, next: nextStatus(order.status, action) };
  } catch (err) {
    if (err instanceof OrderStateError) return { error: err.message };
    throw err;
  }
}

/** Conditional order write. Returns an error message on a miss or a thrown write, else null. */
async function saveOrder(
  repo: AdminOrderRepo,
  order: AdminOrder,
  set: OrderUpdate,
): Promise<string | null> {
  try {
    const saved = await repo.updateOrder(order.id, order.status, set);
    return saved ? null : REFRESH_ERROR;
  } catch (err) {
    console.error("[order-actions] order write threw", order.id, err);
    return SAVE_ERROR;
  }
}

/** Writes an order_events row. A failure is logged and never undoes the change. */
async function recordEvent(
  repo: AdminOrderRepo,
  orderId: string,
  kind: string,
  detail: Record<string, unknown>,
  staffId: string,
): Promise<void> {
  try {
    await repo.addEvent(orderId, kind, detail, staffId);
  } catch (err) {
    console.error("[order-actions] could not write the order event", orderId, err);
  }
}

/** Runs one email send, honouring defer. A send that throws counts as emailFailed. */
async function finish(deps: OrderActionDeps, send: () => Promise<boolean>): Promise<OrderActionResult> {
  if (deps.defer) {
    deps.defer(async () => {
      await send();
    });
    return { ok: true };
  }
  const emailFailed = await send();
  return { ok: true, emailFailed };
}

/**
 * Moves the fulfil date through the staff RPC, which enforces the cap, blocked days and closed orders
 * and writes its own order event. Emails the old and new dates on success.
 */
export async function changeDate(input: ChangeDateInput, deps: OrderActionDeps): Promise<OrderActionResult> {
  const { newDate, overrideCap } = input;
  if (!isIsoDate(newDate)) return { error: DATE_ERROR };
  if (newDate < trinidadToday(deps.now())) return { error: PAST_DATE_ERROR };

  const order = await deps.repo.findOrder(input.orderId);
  if (!order) return { error: ORDER_NOT_FOUND };
  if (newDate === order.fulfilDate) return { error: SAME_DATE_ERROR };

  let oldDate: string;
  try {
    // The RPC reads the old date under its lock, so it is the true "from" date even if another move raced.
    oldDate = await deps.repo.changeFulfilDate(order.id, newDate, overrideCap);
  } catch (err) {
    const message = err instanceof Error ? err.message.trim() : String(err).trim();
    const mapped = DATE_RPC_ERRORS[message];
    if (mapped) return { error: mapped };
    console.error("[order-actions] date change failed", order.id, err);
    return { error: SAVE_ERROR };
  }

  return finish(deps, async () => {
    const sent = await sendTemplate(deps.email, {
      orderId: order.id,
      template: "date_changed",
      to: order.email,
      data: { ...customerBase(order), oldDate, newDate },
    });
    return !sent.ok;
  });
}

/** Marks a confirmed order ready. Emails the customer only when notify is set. */
export async function markReady(input: MarkReadyInput, deps: OrderActionDeps): Promise<OrderActionResult> {
  const found = await advance(deps.repo, input.orderId, "mark_ready");
  if ("error" in found) return found;
  const { order, next } = found;

  const failure = await saveOrder(deps.repo, order, { status: next });
  if (failure) return { error: failure };

  await recordEvent(deps.repo, order.id, "marked_ready", { notify: input.notify }, deps.staff.userId);
  if (!input.notify) return { ok: true };

  return finish(deps, async () => {
    try {
      const pickupInfo = order.fulfilment === "pickup" ? await deps.getPickupInfo() : null;
      const sent = await sendTemplate(deps.email, {
        orderId: order.id,
        template: "order_ready",
        to: order.email,
        data: { ...customerBase(order), fulfilment: order.fulfilment, pickupInfo },
      });
      return !sent.ok;
    } catch (err) {
      console.error("[order-actions] order_ready email failed", order.id, err);
      return true;
    }
  });
}

/** Marks a ready or confirmed order completed. No email. */
export async function markCompleted(input: MarkCompletedInput, deps: OrderActionDeps): Promise<OrderActionResult> {
  const found = await advance(deps.repo, input.orderId, "mark_completed");
  if ("error" in found) return found;
  const { order, next } = found;

  const failure = await saveOrder(deps.repo, order, { status: next });
  if (failure) return { error: failure };

  await recordEvent(deps.repo, order.id, "completed", {}, deps.staff.userId);
  return { ok: true };
}

export const PROOF_AGAIN_REASON = "We couldn't find your payment proof — please upload it again.";

/**
 * For a stuck order: in proof_submitted with no submitted payment row, so there is nothing to confirm
 * or reject. Moves it back to awaiting_payment with a fresh payment window and emails the customer.
 */
export async function requestProofAgain(
  input: { orderId: string },
  deps: OrderActionDeps,
): Promise<OrderActionResult> {
  const order = await deps.repo.findOrder(input.orderId);
  if (!order) return { error: ORDER_NOT_FOUND };
  if (order.status !== "proof_submitted") {
    return { error: `Can't ask for proof again on an order that is ${STATUS_LABEL[order.status].toLowerCase()}` };
  }
  if (await deps.repo.hasSubmittedPayment(order.id)) {
    return { error: "This order has a proof to review — use Confirm or Reject." };
  }

  const failure = await saveOrder(deps.repo, order, {
    status: "awaiting_payment",
    paymentWindowStartedAt: deps.now().toISOString(),
  });
  if (failure) return { error: failure };

  await recordEvent(deps.repo, order.id, "proof_requested_again", { reason: PROOF_AGAIN_REASON }, deps.staff.userId);

  return finish(deps, async () => {
    try {
      const sent = await sendTemplate(deps.email, {
        orderId: order.id,
        template: "proof_rejected",
        to: order.email,
        data: {
          orderNumber: order.orderNumber,
          token: order.accessToken,
          customerName: order.customerName,
          reason: PROOF_AGAIN_REASON,
          totalCents: order.totalCents,
        },
      });
      return !sent.ok;
    } catch (err) {
      console.error("[order-actions] proof_rejected email failed", order.id, err);
      return true;
    }
  });
}

/** Cancels an order with a reason, then emails the customer. */
export async function cancelOrder(input: CancelOrderInput, deps: OrderActionDeps): Promise<OrderActionResult> {
  const reason = input.reason.trim();
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) return { error: REASON_ERROR };

  const found = await advance(deps.repo, input.orderId, "cancel");
  if ("error" in found) return found;
  const { order, next } = found;

  const failure = await saveOrder(deps.repo, order, { status: next });
  if (failure) return { error: failure };

  await recordEvent(deps.repo, order.id, "cancelled", { reason }, deps.staff.userId);

  return finish(deps, async () => {
    try {
      const sent = await sendTemplate(deps.email, {
        orderId: order.id,
        template: "order_cancelled",
        to: order.email,
        data: { ...customerBase(order), reason },
      });
      return !sent.ok;
    } catch (err) {
      console.error("[order-actions] order_cancelled email failed", order.id, err);
      return true;
    }
  });
}
