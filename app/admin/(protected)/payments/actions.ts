"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paymentReviewRepo } from "@/lib/admin/payments-repo";
import { verifyPayment, type VerifyPaymentResult } from "@/lib/admin/verify-payment";
import { requireStaff } from "@/lib/auth/require-staff";
import { defaultEmailDeps } from "@/lib/email/deps";
import { renderReceiptPdf } from "@/lib/receipt/render-receipt";

const inputSchema = z.object({
  paymentId: z.string().min(1),
  decision: z.enum(["confirm", "reject"]),
  reason: z.string().max(1000).optional(),
  shown: z.object({
    receiptPath: z.string().nullable(),
    reference: z.string().nullable(),
  }),
});

export type VerifyPaymentActionInput = z.input<typeof inputSchema>;

/**
 * Confirms or rejects a payment proof. Awaits the email (no defer) so the staff member sees
 * emailFailed and can be told the status was saved.
 */
export async function verifyPaymentAction(input: VerifyPaymentActionInput): Promise<VerifyPaymentResult> {
  const staff = await requireStaff();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Something went wrong — refresh and try again" };

  const result = await verifyPayment(parsed.data, {
    repo: paymentReviewRepo(),
    email: defaultEmailDeps(),
    staff: { userId: staff.userId },
    now: () => new Date(),
    renderPdf: renderReceiptPdf,
  });

  revalidatePath("/admin", "layout");
  return result;
}
