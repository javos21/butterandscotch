"use server";

import { after } from "next/server";
import { normaliseEmail } from "@/lib/customers/normalise-email";
import { defaultEmailDeps } from "@/lib/email/deps";
import { FIND_ORDER_RESPONSE } from "@/lib/orders/find-order-response";
import {
  resendOrderLinks,
  type ResendLinksDeps,
  type ResendOrder,
} from "@/lib/orders/resend-links";
import { createAdminSupabase } from "@/lib/supabase/admin";

const COOLDOWN_MS = 60_000;

/**
 * Best-effort throttle: the same email is not re-sent within 60 seconds.
 * This is in-memory, so it is per server instance. Serverless instances do not share it,
 * and a restart clears it. It only limits casual repeat clicks.
 */
const lastSentAt = new Map<string, number>();

function withinCooldown(email: string, now: number): boolean {
  for (const [key, sentAt] of lastSentAt) {
    if (now - sentAt >= COOLDOWN_MS) lastSentAt.delete(key);
  }
  const last = lastSentAt.get(email);
  if (last !== undefined) return true;
  lastSentAt.set(email, now);
  return false;
}

/** Escapes LIKE wildcards so an email matches literally in ilike. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Production repo. Service role. Excludes cancelled orders, most recent first, at most 20. */
function buildResendRepo(): ResendLinksDeps["repo"] {
  const db = createAdminSupabase();
  return {
    async findOrdersByEmail(email): Promise<ResendOrder[]> {
      const { data, error } = await db
        .from("orders")
        .select("order_number, access_token, customer_name, fulfil_date")
        .ilike("email", escapeLike(email))
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        orderNumber: row.order_number,
        token: row.access_token,
        customerName: row.customer_name,
        fulfilDate: row.fulfil_date,
      }));
    },
  };
}

/**
 * Form action for /find-order. Form field: email.
 * Always returns FIND_ORDER_RESPONSE, so the page cannot reveal which emails have orders.
 *
 * The lookup and send run after the response. If they ran inline, an email with orders would
 * wait on the database and the email provider while an unknown email returned at once, and that
 * timing difference would reveal which addresses have ordered.
 */
export async function findOrderAction(formData: FormData): Promise<typeof FIND_ORDER_RESPONSE> {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  if (withinCooldown(email, Date.now())) return FIND_ORDER_RESPONSE;

  after(async () => {
    try {
      await resendOrderLinks(email, {
        repo: buildResendRepo(),
        email: defaultEmailDeps(),
      });
    } catch (err) {
      console.error("[find-order] findOrderAction failed", err);
    }
  });

  return FIND_ORDER_RESPONSE;
}
