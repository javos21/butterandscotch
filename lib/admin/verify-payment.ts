import { sendTemplate, type EmailDeps } from "@/lib/email/send";
import { nextStatus, OrderStateError, type OrderStatus, type StaffAction } from "@/lib/order-status";
import { trinidadToday } from "@/lib/dates";
import {
  buildReceiptData,
  receiptFilename,
  type ReceiptData,
  type ReceiptOrder,
} from "@/lib/receipt/receipt-data";

const ALREADY_REVIEWED = "This payment was already reviewed";
const REFRESH_ERROR = "Order was updated — refresh";
const PROOF_CHANGED = "The customer uploaded a new proof — refresh and check again";
const REASON_ERROR = "Please give a reason (3–300 characters)";
const REASON_MIN = 3;
const REASON_MAX = 300;

export type PaymentStatus = "submitted" | "confirmed" | "rejected";

export type PaymentRecord = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  reference: string | null;
  receiptPath: string | null;
};

/** The order fields a review needs: the receipt fields plus the customer contact and status. */
export type ReviewOrder = ReceiptOrder & {
  id: string;
  accessToken: string;
  email: string;
  status: OrderStatus;
};

export type PaymentExpect = {
  status: PaymentStatus;
  reference: string | null;
  receiptPath: string | null;
};

export type PaymentReview = {
  status: PaymentStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
};

/**
 * Persistence for a proof review. Production wiring: lib/admin/payments-repo.ts.
 * Each write is conditional: it applies only when the row still holds the value read earlier,
 * and reports false when it does not.
 */
export type PaymentReviewRepo = {
  findPayment(paymentId: string): Promise<PaymentRecord | null>;
  /** Applies `set` only while every field of `expect` still matches the row. */
  updatePayment(paymentId: string, expect: PaymentExpect, set: PaymentReview): Promise<boolean>;
  findOrder(orderId: string): Promise<ReviewOrder | null>;
  /**
   * Moves the order from `from` to `to`, only while it is still in `from`.
   * A non-null `windowStart` restarts the payment window and clears the reminder.
   */
  moveOrder(orderId: string, from: OrderStatus, to: OrderStatus, windowStart: string | null): Promise<boolean>;
  addEvent(orderId: string, kind: string, detail: Record<string, unknown>, staffId: string): Promise<void>;
  getWhatsappNumber(): Promise<string>;
};

export type VerifyPaymentInput = {
  paymentId: string;
  decision: "confirm" | "reject";
  reason?: string;
  /** The proof the staff member saw on the card. */
  shown: { receiptPath: string | null; reference: string | null };
};

export type VerifyPaymentDeps = {
  repo: PaymentReviewRepo;
  email: EmailDeps;
  staff: { userId: string };
  now: () => Date;
  renderPdf: (data: ReceiptData) => Promise<Buffer>;
  /** Production defers emails after the response; staff actions omit it and await the send. */
  defer?: (task: () => Promise<void>) => void;
};

export type VerifyPaymentResult = { ok: true; emailFailed?: boolean } | { error: string };

function proofMatches(payment: PaymentRecord, shown: VerifyPaymentInput["shown"]): boolean {
  return payment.reference === shown.reference && payment.receiptPath === shown.receiptPath;
}

/** Why a conditional payment write missed: the review already happened, or the proof changed. */
async function missReason(repo: PaymentReviewRepo, paymentId: string): Promise<string> {
  const current = await repo.findPayment(paymentId);
  if (!current || current.status !== "submitted") return ALREADY_REVIEWED;
  return PROOF_CHANGED;
}

/** Puts the payment back to submitted after the order write missed. Never throws. */
async function revertPayment(repo: PaymentReviewRepo, payment: PaymentRecord, from: PaymentStatus): Promise<void> {
  try {
    const reverted = await repo.updatePayment(
      payment.id,
      { status: from, reference: payment.reference, receiptPath: payment.receiptPath },
      { status: "submitted", reviewedBy: null, reviewedAt: null, rejectReason: null },
    );
    if (!reverted) console.error("[verify-payment] payment changed before the revert", payment.id);
  } catch (err) {
    console.error("[verify-payment] revert threw", payment.id, err);
  }
}

/**
 * Confirms or rejects a submitted payment proof. The payment is updated only while it still holds
 * the proof the staff member saw; the order then moves on under a conditional status write. If the
 * order write misses, the payment is put back. Email and PDF failures never undo the decision.
 */
export async function verifyPayment(
  input: VerifyPaymentInput,
  deps: VerifyPaymentDeps,
): Promise<VerifyPaymentResult> {
  const { repo } = deps;
  const reason = (input.reason ?? "").trim();
  if (input.decision === "reject" && (reason.length < REASON_MIN || reason.length > REASON_MAX)) {
    return { error: REASON_ERROR };
  }

  const payment = await repo.findPayment(input.paymentId);
  if (!payment) return { error: "Payment not found" };
  if (payment.status !== "submitted") return { error: ALREADY_REVIEWED };
  if (!proofMatches(payment, input.shown)) return { error: PROOF_CHANGED };

  const order = await repo.findOrder(payment.orderId);
  if (!order) return { error: "Order not found" };

  const action: StaffAction = input.decision === "confirm" ? "confirm_proof" : "reject_proof";
  let next: OrderStatus;
  try {
    next = nextStatus(order.status, action);
  } catch (err) {
    if (err instanceof OrderStateError) return { error: err.message };
    throw err;
  }

  const now = deps.now();
  const reviewedAt = now.toISOString();
  const confirmed = input.decision === "confirm";
  const outcome: PaymentStatus = confirmed ? "confirmed" : "rejected";

  const marked = await repo.updatePayment(
    payment.id,
    { status: "submitted", reference: input.shown.reference, receiptPath: input.shown.receiptPath },
    {
      status: outcome,
      reviewedBy: deps.staff.userId,
      reviewedAt,
      rejectReason: confirmed ? null : reason,
    },
  );
  if (!marked) return { error: await missReason(repo, payment.id) };

  const moved = await repo.moveOrder(order.id, order.status, next, confirmed ? null : reviewedAt);
  if (!moved) {
    await revertPayment(repo, payment, outcome);
    return { error: REFRESH_ERROR };
  }

  try {
    await repo.addEvent(
      order.id,
      confirmed ? "payment_confirmed" : "payment_rejected",
      confirmed ? { paymentId: payment.id } : { paymentId: payment.id, reason },
      deps.staff.userId,
    );
  } catch (err) {
    console.error("[verify-payment] could not write the order event", order.id, err);
  }

  const sendEmail = async (): Promise<boolean> => {
    if (!confirmed) {
      const sent = await sendTemplate(deps.email, {
        orderId: order.id,
        template: "proof_rejected",
        to: order.email,
        data: {
          orderNumber: order.orderNumber,
          token: order.accessToken,
          customerName: order.customerName,
          reason,
          totalCents: order.totalCents,
        },
      });
      return !sent.ok;
    }
    return sendReceiptEmail(deps, order);
  };

  if (deps.defer) {
    deps.defer(async () => {
      await sendEmail();
    });
    return { ok: true };
  }
  const emailFailed = await sendEmail();
  return { ok: true, emailFailed };
}

/**
 * Renders the receipt and sends order_confirmed with it attached. A render failure is logged
 * against order_confirmed and no email goes out, since its subject promises an attachment.
 * Returns true when the email did not go out.
 */
async function sendReceiptEmail(deps: VerifyPaymentDeps, order: ReviewOrder): Promise<boolean> {
  let pdf: Buffer;
  try {
    const whatsappNumber = await deps.repo.getWhatsappNumber();
    const data = buildReceiptData(order, trinidadToday(deps.now()), whatsappNumber);
    pdf = await deps.renderPdf(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await deps.email.log({
        order_id: order.id,
        template: "order_confirmed",
        to_email: order.email,
        provider_id: null,
        error: `receipt render failed: ${message}`,
      });
    } catch (logErr) {
      console.error("[verify-payment] failed to write email_log", logErr);
    }
    return true;
  }

  const sent = await sendTemplate(deps.email, {
    orderId: order.id,
    template: "order_confirmed",
    to: order.email,
    data: {
      orderNumber: order.orderNumber,
      token: order.accessToken,
      customerName: order.customerName,
      fulfilDate: order.fulfilDate,
      fulfilment: order.fulfilment,
      totalCents: order.totalCents,
    },
    attachments: [{ filename: receiptFilename(order.orderNumber), content: pdf }],
  });
  return !sent.ok;
}
