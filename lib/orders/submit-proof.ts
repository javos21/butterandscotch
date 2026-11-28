import { RECEIPT_MAX_BYTES } from "@/lib/receipt-file";
import { sendTemplate } from "@/lib/email/send";
import type { EmailDeps } from "@/lib/email/types";
import { afterProofSubmitted, OrderStateError, type OrderStatus } from "@/lib/order-status";

/** Receipt MIME types and the extension each one is stored under. The source of stored extensions. */
export const RECEIPT_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/**
 * Some browsers (Chrome on Windows and Android) send an empty MIME type for HEIC and HEIF files.
 * When the type is empty, the filename extension decides, using these canonical types.
 */
const EXTENSION_TYPES: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

const FILE_ERROR = "Please upload a JPG, PNG, WEBP, HEIC or PDF up to 4 MB";
const REFERENCE_ERROR = "Please enter the payment reference (3–64 characters)";
const REFRESH_ERROR = "Your order was updated — please refresh";

export type ProofFile = {
  name: string;
  type: string;
  size: number;
  bytes: ArrayBuffer;
};

export type ProofPayment = {
  id: string;
  status: "submitted" | "confirmed" | "rejected";
  amount_cents: number;
  reference: string | null;
  receipt_path: string | null;
  reject_reason: string | null;
};

export type ProofOrder = {
  id: string;
  order_number: string;
  access_token: string;
  customer_name: string;
  email: string;
  status: OrderStatus;
  total_cents: number;
  payments: ProofPayment[];
};

export type UpsertPendingPayment = {
  orderId: string;
  amountCents: number;
  /** Null when the customer left the reference blank. */
  reference: string | null;
  receiptPath: string;
};

/**
 * What the write did.
 * "updated": the submitted row was changed to the new proof. `replacedReceiptPath` is the receipt
 *   that row held before, read from the same row the update changed.
 * "inserted": a new submitted row was created. No earlier receipt is involved.
 * "settled": the submitted row was confirmed or rejected before the write. Nothing was written.
 */
export type UpsertResult =
  | { outcome: "updated"; paymentId: string; replacedReceiptPath: string | null }
  | { outcome: "inserted"; paymentId: string }
  | { outcome: "settled" };

/** Persistence for one proof. Production wiring lives in app/(shop)/order/[token]/actions.ts. */
export type ProofRepo = {
  getOrderByToken(token: string): Promise<ProofOrder | null>;
  getSettings(): Promise<{ notify_email: string | null }>;
  uploadReceipt(path: string, file: ProofFile): Promise<void>;
  /** Replaces the order's submitted payment, or inserts one. */
  upsertPendingPayment(payment: UpsertPendingPayment): Promise<UpsertResult>;
  /**
   * Removes a row this request inserted, only while it is still submitted.
   * Returns false when staff have already settled it, in which case nothing is deleted.
   */
  deletePendingPayment(paymentId: string): Promise<boolean>;
  deleteReceipt(path: string): Promise<void>;
  /** Moves the order from `from` to `to`. Returns false if the order was no longer in `from`. */
  setStatus(orderId: string, from: OrderStatus, to: OrderStatus): Promise<boolean>;
};

export type SubmitProofInput = {
  token: string;
  reference: string;
  file: ProofFile;
};

export type SubmitProofDeps = {
  repo: ProofRepo;
  email: EmailDeps;
  /** Public site origin, used to build the staff link. */
  siteUrl: string;
  /** Production schedules email after the response; tests omit this and await delivery inline. */
  defer?: (task: () => Promise<void>) => void;
};

export type SubmitProofResult = { ok: true } | { error: string };

/** The customer-facing message for a proof the order state does not accept. */
function stateErrorMessage(status: OrderStatus, err: OrderStateError): string {
  if (status === "cancelled") return "This order was cancelled";
  if (status === "confirmed" || status === "ready" || status === "completed") {
    return "Your payment is already confirmed";
  }
  return err.message;
}

/** The canonical MIME type for an accepted receipt, or null if the file is not one. */
function receiptMimeType(file: ProofFile): string | null {
  if (file.type !== "") {
    return Object.hasOwn(RECEIPT_EXTENSIONS, file.type) ? file.type : null;
  }
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return null;
  const extension = file.name.slice(dot + 1).toLowerCase();
  return Object.hasOwn(EXTENSION_TYPES, extension) ? EXTENSION_TYPES[extension] : null;
}

/** Best-effort removal of a receipt that will not be referenced. Never masks the caller's error. */
async function discardReceipt(repo: ProofRepo, path: string): Promise<void> {
  try {
    await repo.deleteReceipt(path);
  } catch (err) {
    console.error("[proof] failed to delete receipt", path, err);
  }
}

/**
 * Records a payment proof: validates the file and reference, moves the order forward,
 * stores the receipt, and sends the two emails. Pure apart from the injected repo and email.
 * The amount is always the order total. The reference is optional.
 */
export async function submitProof(
  input: SubmitProofInput,
  deps: SubmitProofDeps,
): Promise<SubmitProofResult> {
  const order = await deps.repo.getOrderByToken(input.token);
  if (!order) return { error: "Order not found" };

  const { file } = input;
  const mime = receiptMimeType(file);
  const extension = mime ? RECEIPT_EXTENSIONS[mime] : undefined;
  if (!mime || !extension || file.size > RECEIPT_MAX_BYTES) return { error: FILE_ERROR };

  const trimmedReference = input.reference.trim();
  let reference: string | null = null;
  if (trimmedReference.length > 0) {
    if (trimmedReference.length < 3 || trimmedReference.length > 64) {
      return { error: REFERENCE_ERROR };
    }
    reference = trimmedReference;
  }

  let next: OrderStatus;
  try {
    next = afterProofSubmitted(order.status);
  } catch (err) {
    if (err instanceof OrderStateError) {
      return { error: stateErrorMessage(order.status, err) };
    }
    throw err;
  }

  const settings = await deps.repo.getSettings();
  const amountCents = order.total_cents;

  const receiptPath = `${order.id}/payment-${Date.now()}.${extension}`;

  // Guard first. The status is moved conditionally on the value we read, even when it does not change.
  // A concurrent confirm, reject or cancel fails here, before anything is uploaded or written.
  const moved = await deps.repo.setStatus(order.id, order.status, next);
  if (!moved) return { error: REFRESH_ERROR };

  /** Puts the order status back if it is still where this request moved it. Never throws. */
  const revertStatus = async (): Promise<void> => {
    if (next === order.status) return;
    try {
      await deps.repo.setStatus(order.id, next, order.status);
    } catch (err) {
      console.error("[proof] failed to put back the order status", err);
    }
  };

  let replacedReceiptPath: string | null = null;
  let rowWritten = false;
  try {
    await deps.repo.uploadReceipt(receiptPath, { ...file, type: mime });
    const result = await deps.repo.upsertPendingPayment({
      orderId: order.id,
      amountCents,
      reference,
      receiptPath,
    });

    if (result.outcome === "settled") {
      // No row references the new receipt. Staff settled the earlier row during the upload.
      await discardReceipt(deps.repo, receiptPath);
      await revertStatus();
      return { error: REFRESH_ERROR };
    }
    rowWritten = true;

    if (result.outcome === "updated") {
      // The customer's own pending row now holds this proof. If the order moves on after the
      // write, that is a legitimate settle of the new proof, so it is accepted without undo.
      replacedReceiptPath = result.replacedReceiptPath;
    } else {
      // Inserted beside an earlier payment that staff may have settled during the upload.
      // If the order is no longer where we left it, remove this stray row, unless staff
      // already settled it (then deletePendingPayment is false and the row is theirs).
      const current = await deps.repo.getOrderByToken(input.token);
      if (current?.status !== next) {
        const removed = await deps.repo.deletePendingPayment(result.paymentId);
        if (removed) {
          await discardReceipt(deps.repo, receiptPath);
          return { error: REFRESH_ERROR };
        }
      }
    }
  } catch (err) {
    // Undo only what is certain to be ours. Once a row is written it stays, and its receipt is referenced.
    if (!rowWritten) {
      await discardReceipt(deps.repo, receiptPath);
      await revertStatus();
    }
    throw err;
  }

  if (replacedReceiptPath) await discardReceipt(deps.repo, replacedReceiptPath);

  const sendEmails = async () => {
    const sends: Promise<{ ok: boolean }>[] = [
      sendTemplate(deps.email, {
        orderId: order.id,
        template: "proof_received",
        to: order.email,
        data: {
          orderNumber: order.order_number,
          token: order.access_token,
          customerName: order.customer_name,
          totalCents: order.total_cents,
        },
      }),
    ];

    if (settings.notify_email) {
      // The admin link is built inside the try: an unset site URL skips only the staff alert.
      try {
        const base = deps.siteUrl.replace(/\/+$/, "");
        if (!base) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
        sends.push(
          sendTemplate(deps.email, {
            orderId: order.id,
            template: "staff_proof_received",
            to: settings.notify_email,
            data: {
              orderNumber: order.order_number,
              customerName: order.customer_name,
              totalCents: order.total_cents,
              adminUrl: `${base}/admin/orders/${order.id}`,
            },
          }),
        );
      } catch (err) {
        console.error("[proof] staff proof email skipped", err);
      }
    }
    await Promise.all(sends);
  };

  if (deps.defer) deps.defer(sendEmails);
  else await sendEmails();

  return { ok: true };
}
