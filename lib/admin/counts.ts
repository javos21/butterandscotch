import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type AdminCounts = { proofsToCheck: number; quotesToSet: number };

/**
 * Badge counts for the admin navigation. Callers must run requireStaff() first.
 * proofsToCheck: orders waiting for staff to check a payment proof.
 * quotesToSet: orders waiting for a delivery fee to be set.
 */
export async function getAdminCounts(): Promise<AdminCounts> {
  const supabase = createAdminSupabase();
  const [proofs, quotes] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "proof_submitted"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "awaiting_quote"),
  ]);
  if (proofs.error) throw proofs.error;
  if (quotes.error) throw quotes.error;
  return { proofsToCheck: proofs.count ?? 0, quotesToSet: quotes.count ?? 0 };
}
