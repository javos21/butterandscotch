"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cancelOrder,
  changeDate,
  markCompleted,
  markReady,
  requestProofAgain,
  type CancelOrderInput,
  type ChangeDateInput,
  type MarkCompletedInput,
  type MarkReadyInput,
  type OrderActionDeps,
  type OrderActionResult,
} from "@/lib/admin/order-actions";
import { adminOrderRepo } from "@/lib/admin/orders-repo";
import { requireStaff } from "@/lib/auth/require-staff";
import { getBankDetails, getPublicSettings } from "@/lib/data/settings";
import { defaultEmailDeps } from "@/lib/email/deps";
import { createServerSupabase } from "@/lib/supabase/server";

const SAFE_ERROR = "Something went wrong — refresh and try again";

const orderIdSchema = z.string().min(1);

const dateSchema = z.object({
  orderId: orderIdSchema,
  newDate: z.string(),
  overrideCap: z.boolean(),
});
const readySchema = z.object({ orderId: orderIdSchema, notify: z.boolean() });
const completedSchema = z.object({ orderId: orderIdSchema });
const cancelSchema = z.object({ orderId: orderIdSchema, reason: z.string().max(1000) });

/**
 * Builds the domain dependencies. The date RPC runs on the signed-in staff client so is_staff() sees
 * the user; everything else uses the service role inside the repo. Callers must run requireStaff() first.
 */
async function actionDeps(staffUserId: string): Promise<OrderActionDeps> {
  const staffDb = await createServerSupabase();
  return {
    repo: adminOrderRepo(staffDb),
    email: defaultEmailDeps(),
    staff: { userId: staffUserId },
    now: () => new Date(),
    getBank: getBankDetails,
    getPickupInfo: async () => (await getPublicSettings()).pickup_info,
  };
}

/** Moves the fulfil date through the staff RPC and emails the customer the change. */
export async function changeDateAction(input: ChangeDateInput): Promise<OrderActionResult> {
  const staff = await requireStaff();

  const parsed = dateSchema.safeParse(input);
  if (!parsed.success) return { error: SAFE_ERROR };

  const result = await changeDate(parsed.data, await actionDeps(staff.userId));
  revalidatePath("/admin", "layout");
  return result;
}

/** Marks a confirmed order ready, optionally emailing the customer. */
export async function markReadyAction(input: MarkReadyInput): Promise<OrderActionResult> {
  const staff = await requireStaff();

  const parsed = readySchema.safeParse(input);
  if (!parsed.success) return { error: SAFE_ERROR };

  const result = await markReady(parsed.data, await actionDeps(staff.userId));
  revalidatePath("/admin", "layout");
  return result;
}

/** Marks a ready or confirmed order completed. */
export async function markCompletedAction(input: MarkCompletedInput): Promise<OrderActionResult> {
  const staff = await requireStaff();

  const parsed = completedSchema.safeParse(input);
  if (!parsed.success) return { error: SAFE_ERROR };

  const result = await markCompleted(parsed.data, await actionDeps(staff.userId));
  revalidatePath("/admin", "layout");
  return result;
}

/** Asks the customer to upload payment proof again on a stuck order (proof_submitted with no proof file). */
export async function requestProofAgainAction(input: { orderId: string }): Promise<OrderActionResult> {
  const staff = await requireStaff();

  const parsed = z.object({ orderId: orderIdSchema }).safeParse(input);
  if (!parsed.success) return { error: SAFE_ERROR };

  const result = await requestProofAgain(parsed.data, await actionDeps(staff.userId));
  revalidatePath("/admin", "layout");
  return result;
}

/** Cancels an order with a reason and emails the customer. */
export async function cancelOrderAction(input: CancelOrderInput): Promise<OrderActionResult> {
  const staff = await requireStaff();

  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { error: SAFE_ERROR };

  const result = await cancelOrder(parsed.data, await actionDeps(staff.userId));
  revalidatePath("/admin", "layout");
  return result;
}
