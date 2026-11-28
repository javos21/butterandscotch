import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type AdminCounts = { proofsToCheck: number };

/**
 * Badge counts for the admin navigation. Callers must run requireStaff() first.
 * proofsToCheck: orders waiting for staff to check a payment proof.
 */
export async function getAdminCounts(): Promise<AdminCounts> {
  const supabase = createAdminSupabase();
  const proofs = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "proof_submitted");
  if (proofs.error) throw proofs.error;
  return { proofsToCheck: proofs.count ?? 0 };
}
