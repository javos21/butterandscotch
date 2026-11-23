"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { RECEIPT_MAX_BYTES } from "@/lib/receipt-file";
import { defaultEmailDeps } from "@/lib/email/deps";
import {
  submitProof,
  type ProofOrder,
  type ProofRepo,
  type SubmitProofResult,
  type UpsertPendingPayment,
  type UpsertResult,
} from "@/lib/orders/submit-proof";
import type { OrderStatus } from "@/lib/order-status";
import { createAdminSupabase } from "@/lib/supabase/admin";

const RECEIPTS_BUCKET = "receipts";
const UNIQUE_VIOLATION = "23505";

type SubmittedRow = { id: string; receipt_path: string | null };

type PaymentFields = {
  amount_cents: number;
  reference: string | null;
  receipt_path: string;
};

/** Production repository for payment proofs. Service role; the receipts bucket is private. */
function buildProofRepo(): ProofRepo {
  const db = createAdminSupabase();

  async function submittedPayment(orderId: string): Promise<SubmittedRow | null> {
    const { data, error } = await db
      .from("payments")
      .select("id, receipt_path")
      .eq("order_id", orderId)
      .eq("status", "submitted")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { id: data.id, receipt_path: data.receipt_path } : null;
  }

  /**
   * Replaces the row only if it is still submitted and still holds the receipt we read.
   * Anything that changed it in between (a confirm, a reject, another submit) makes this
   * match nothing, which is reported as "settled".
   */
  async function replaceSubmitted(row: SubmittedRow, fields: PaymentFields): Promise<UpsertResult> {
    let query = db
      .from("payments")
      .update(fields)
      .eq("id", row.id)
      .eq("status", "submitted");
    query =
      row.receipt_path === null
        ? query.is("receipt_path", null)
        : query.eq("receipt_path", row.receipt_path);

    const { data, error } = await query.select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length === 0) return { outcome: "settled" };
    return { outcome: "updated", paymentId: row.id, replacedReceiptPath: row.receipt_path };
  }

  return {
    async getOrderByToken(token): Promise<ProofOrder | null> {
      const { data, error } = await db
        .from("orders")
        .select("id, order_number, access_token, customer_name, email, status, total_cents, payments(id, status, amount_cents, reference, receipt_path, reject_reason)")
        .eq("access_token", token)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        id: data.id,
        order_number: data.order_number,
        access_token: data.access_token,
        customer_name: data.customer_name,
        email: data.email,
        status: data.status as OrderStatus,
        total_cents: data.total_cents,
        payments: data.payments.map((payment) => ({
          id: payment.id,
          status: payment.status as "submitted" | "confirmed" | "rejected",
          amount_cents: payment.amount_cents,
          reference: payment.reference,
          receipt_path: payment.receipt_path,
          reject_reason: payment.reject_reason,
        })),
      };
    },

    /** notify_email is left out of the public settings view, so it is read with the service role. */
    async getSettings() {
      const { data, error } = await db
        .from("settings")
        .select("notify_email")
        .eq("id", 1)
        .single();
      if (error) throw new Error(error.message);
      return { notify_email: data.notify_email };
    },

    async uploadReceipt(path, file) {
      const { error } = await db.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, new Blob([file.bytes], { type: file.type }), {
          contentType: file.type,
          upsert: false,
        });
      if (error) throw new Error(error.message);
    },

    /**
     * Updates the order's submitted payment if there is one, otherwise inserts it.
     * The partial unique index allows one submitted row per order. If a concurrent
     * submit inserts first (23505), this updates that row instead.
     */
    async upsertPendingPayment(payment: UpsertPendingPayment): Promise<UpsertResult> {
      const fields: PaymentFields = {
        amount_cents: payment.amountCents,
        reference: payment.reference,
        receipt_path: payment.receiptPath,
      };

      const existing = await submittedPayment(payment.orderId);
      if (existing) return replaceSubmitted(existing, fields);

      const { data, error } = await db
        .from("payments")
        .insert({
          ...fields,
          order_id: payment.orderId,
          status: "submitted",
        })
        .select("id")
        .single();
      if (!error && data) return { outcome: "inserted", paymentId: data.id };
      if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);

      // A concurrent submit inserted first. Replace the row that won.
      const raced = await submittedPayment(payment.orderId);
      if (!raced) throw new Error(error?.message ?? "payment insert returned no row");
      return replaceSubmitted(raced, fields);
    },

    /** Deletes only while the row is still submitted. False means staff settled it first. */
    async deletePendingPayment(paymentId) {
      const { data, error } = await db
        .from("payments")
        .delete()
        .eq("id", paymentId)
        .eq("status", "submitted")
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },

    async deleteReceipt(path) {
      const { error } = await db.storage.from(RECEIPTS_BUCKET).remove([path]);
      if (error) throw new Error(error.message);
    },

    /** Conditional on the status read earlier, so it cannot overwrite a concurrent cancel. */
    async setStatus(orderId, from, to) {
      const { data, error } = await db
        .from("orders")
        .update({ status: to })
        .eq("id", orderId)
        .eq("status", from)
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
  };
}

/**
 * Form action for the payment proof upload on the order page.
 * Form fields: token, reference (optional), receipt (file).
 */
export async function submitProofAction(formData: FormData): Promise<SubmitProofResult> {
  const token = String(formData.get("token") ?? "");
  const reference = String(formData.get("reference") ?? "");
  const receipt = formData.get("receipt");

  try {
    // Oversized files are rejected by submitProof before any bytes are used.
    const file =
      receipt instanceof File
        ? {
            name: receipt.name,
            type: receipt.type,
            size: receipt.size,
            bytes:
              receipt.size <= RECEIPT_MAX_BYTES ? await receipt.arrayBuffer() : new ArrayBuffer(0),
          }
        : { name: "", type: "", size: 0, bytes: new ArrayBuffer(0) };

    const result = await submitProof(
      { token, reference, file },
      {
        repo: buildProofRepo(),
        email: defaultEmailDeps(),
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
        defer: (task) => after(task),
      },
    );

    if ("ok" in result) revalidatePath(`/order/${token}`);
    return result;
  } catch (err) {
    console.error("[proof] submitProofAction failed", err);
    return { error: "Something went wrong. Please try again." };
  }
}
